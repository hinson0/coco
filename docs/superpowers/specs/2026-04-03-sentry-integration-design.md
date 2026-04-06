# Sentry 集成设计文档

**日期**：2026-04-03  
**状态**：已批准  
**涉及范围**：`apps/backend`

---

## 背景

后端目前完全没有错误追踪和性能监控。Service 层调用腾讯云 ASR/OCR 和 GLM 的外部 API，一旦出错异常直接冒泡，生产环境无法感知失败原因和耗时分布。

---

## 目标

1. **错误追踪**：捕获所有未处理异常，在 Sentry Dashboard 查看报错详情
2. **性能监控**：通过 Tracing 追踪每个请求的耗时，区分 ASR/OCR/GLM 各自消耗时间
3. **数据安全**：不上报请求体中的 base64 原始内容，仅保留元信息（字段长度）

---

## 技术选型

- **SDK**：`sentry-sdk[fastapi]`（官方 FastAPI 集成）
- **采样率**：通过 `.env` 配置，开发 `1.0`，生产 `0.1`
- **DSN 管理**：`sentry_dsn` 为可选字段，不填则 Sentry 完全禁用

---

## 改动文件

| 文件 | 改动内容 |
|------|----------|
| `pyproject.toml` | 新增依赖 `sentry-sdk[fastapi]` |
| `config.py` | 新增 `sentry_dsn: str \| None` 和 `sentry_traces_sample_rate: float` |
| `main.py` | Sentry 初始化（lifespan）+ `before_send` 脱敏钩子 |
| `services/tencent.py` | ASR/OCR 外部调用包裹 custom span |
| `services/glm.py` | GLM 外部调用包裹 custom span |
| `.env` | 新增 `SENTRY_DSN`、`SENTRY_TRACES_SAMPLE_RATE` |

---

## 详细设计

### 1. 依赖安装

```bash
# 在 apps/backend/ 目录下执行
uv add "sentry-sdk[fastapi]"
```

### 2. 配置层（`config.py`）

在 `Settings` 类新增两个字段：

```python
sentry_dsn: str | None = None
sentry_traces_sample_rate: float = 1.0
```

- `sentry_dsn` 默认 `None`：本地不配置时 Sentry 不启动，不影响开发
- `sentry_traces_sample_rate` 默认 `1.0`：生产环境通过 `.env` 覆盖为 `0.1`

### 3. 初始化（`main.py`）

使用 `lifespan` 进行初始化（符合项目 FastAPI 规范，替代废弃的 `@app.on_event`）：

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            integrations=[FastApiIntegration()],
            traces_sample_rate=settings.sentry_traces_sample_rate,
            before_send=scrub_request_data,
        )
    yield

app = FastAPI(title="CoCo backend", lifespan=lifespan)
```

### 4. 数据脱敏（`before_send` 钩子）

在 `main.py` 中定义 `scrub_request_data(event, hint)` 函数：

- 遍历 `event.get("request", {}).get("data", {})` 中的所有字段
- 字段名以 `Base64` 结尾（如 `audioBase64`、`imageBase64`）时，替换为 `"[filtered, len=<原始字节长度>]"`
- 其他字段保持不变
- 返回修改后的 `event`

**示例效果**：
```
# 原始请求体
{"audioBase64": "AABB...12345字节..."}

# Sentry 收到的内容
{"audioBase64": "[filtered, len=12345]"}
```

### 5. Custom Spans（`services/tencent.py` & `services/glm.py`）

用 `sentry_sdk.start_span()` 包裹外部 API 调用，使 Tracing 能区分各服务耗时：

**`services/tencent.py`**：
- `recognize_speech()`：span `op="tencent.asr"`，附加 `data={"audio_len": len(audio_base64)}`
- `recognize_receipt()`：span `op="tencent.ocr"`，附加 `data={"image_len": len(image_base64)}`

**`services/glm.py`**：
- `call_glm()`：span `op="glm.chat"`，附加 `data={"prompt_len": len(prompt), "model": "glm-4.7-flash"}`
- **不上报** prompt 内容和 response 内容

**Tracing 树结构**：
```
transaction: POST /record-asr
  └─ span: tencent.asr  (data: audio_len=12345)

transaction: POST /record-ocr
  └─ span: tencent.ocr  (data: image_len=67890)

transaction: POST /record-text
  └─ span: glm.chat     (data: prompt_len=234, model=glm-4.7-flash)
```

### 6. 环境变量配置

**`.env`（开发）**：
```
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project-id>
SENTRY_TRACES_SAMPLE_RATE=1.0
```

**生产环境**（Docker Compose / 服务器）：
```
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project-id>
SENTRY_TRACES_SAMPLE_RATE=0.1
```

---

## Sentry 注册步骤

1. 访问 [sentry.io](https://sentry.io) 注册账号
2. 创建新项目，平台选择 **Python → FastAPI**
3. 复制 DSN，填入 `.env` 的 `SENTRY_DSN`

---

## 不在本次范围内

- 自定义 middleware 注入 request-id（方案 C）
- Breadcrumbs 记录业务流程步骤
- 每个 router 打自定义 tag
- 前端 Sentry 集成

---

## 验收标准

1. 本地不填 `SENTRY_DSN` 时，服务正常启动，无任何 Sentry 相关报错
2. 填入有效 DSN 后，调用 `/record-asr` 接口，Sentry 能收到对应 transaction
3. Transaction 中包含 `tencent.asr` span，且有 `audio_len` 数据
4. Sentry event 中 `audioBase64` 字段显示为 `[filtered, len=xxx]`，不含原始内容
5. 故意触发异常时，Sentry 能捕获并展示完整堆栈

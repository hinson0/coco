# structlog 结构化日志集成设计文档

**日期**：2026-04-03  
**状态**：已批准  
**涉及范围**：`apps/backend`

---

## 背景

后端目前完全无日志。`services/tencent.py` 和 `services/glm.py` 调用外部 API 时，成功或失败均无任何记录，生产环境无法排查问题。

---

## 目标

1. **服务调用可观测**：ASR、OCR、GLM 每次调用记录输入元信息 + 耗时 + 结果内容
2. **开发体验友好**：开发环境输出彩色格式化文本，含模块名、毫秒时间戳
3. **生产格式标准化**：生产环境输出单行 JSON，便于接入日志平台
4. **动态级别控制**：通过 `.env` 配置 `LOG_LEVEL`，无需改代码

---

## 技术选型

- **库**：`structlog`（结构化日志，支持 dev/prod 双渲染器）
- **格式切换**：通过 `APP_ENV=dev|prod` 环境变量控制
- **级别控制**：通过 `LOG_LEVEL=DEBUG|INFO|WARNING` 环境变量控制

---

## 改动文件

| 文件 | 操作 | 职责 |
|------|------|------|
| `pyproject.toml` | 修改 | 新增 structlog 依赖 |
| `config.py` | 修改 | 新增 `app_env`、`log_level` 字段 |
| `logging_config.py` | **新建** | 集中管理 structlog 配置，`setup_logging()` |
| `main.py` | 修改 | lifespan 调用 `setup_logging()` |
| `services/tencent.py` | 修改 | ASR/OCR 调用日志 |
| `services/glm.py` | 修改 | GLM 调用日志 |
| `routers/ocr.py` | 修改 | OCR 解析结果日志 |
| `routers/text.py` | 修改 | 文本意图/记账/查询日志 |
| `.env` | 修改 | 新增 `APP_ENV`、`LOG_LEVEL` |
| `.env.example` | 修改 | 同步更新示例 |

---

## 详细设计

### 1. 依赖安装

```bash
cd apps/backend
uv add structlog
```

### 2. 配置层（`config.py`）

新增两个字段：

```python
app_env: str = "dev"      # "dev" 或 "prod"
log_level: str = "DEBUG"  # "DEBUG" / "INFO" / "WARNING"
```

**`.env`（开发）**：
```
APP_ENV=dev
LOG_LEVEL=DEBUG
```

**生产环境**：
```
APP_ENV=prod
LOG_LEVEL=INFO
```

### 3. logging_config.py（新建）

`setup_logging(env: str, level: str)` 函数负责一次性配置全局 structlog：

**processors 链**（两种环境通用前段）：
1. `structlog.stdlib.add_log_level` — 注入 level 字段
2. `structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S.%f", utc=False)` — 毫秒精度本地时间
3. `structlog.processors.CallsiteParameterAdder([CallsiteParameter.MODULE])` — 注入模块名
4. `structlog.processors.StackInfoRenderer()` — 异常栈
5. **dev**：`structlog.dev.ConsoleRenderer(colors=True)` — 彩色格式化文本
5. **prod**：`structlog.processors.JSONRenderer()` — 单行 JSON

同时配置 stdlib `logging`，使 uvicorn 的日志也经过 structlog 渲染。

### 4. main.py

在 `lifespan` 中调用（使用 `asynccontextmanager`）：

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings.app_env, settings.log_level)
    yield
```

### 5. 日志规范

#### services/tencent.py

```
asr.start    audio_len=<字节数>
asr.done     audio_len=<字节数>   duration_ms=<耗时>   result="<ASR识别文字>"
asr.error    audio_len=<字节数>   error="<错误信息>"

ocr.start    image_len=<字节数>
ocr.done     image_len=<字节数>   duration_ms=<耗时>   raw_len=<OCR原始文字字节数>
ocr.error    image_len=<字节数>   error="<错误信息>"
```

**不记录**：`audioBase64` 和 `imageBase64` 原始内容。

#### routers/ocr.py

```
ocr.parsed     amount=<金额>   merchant="<商户名>"   date="<日期>"
ocr.no_amount  ocr_text_len=<长度>    ← 识别到文字但没有金额
ocr.empty                             ← OCR 返回空，无法识别
```

#### services/glm.py

```
glm.start    prompt_len=<字符数>   model="glm-4.7-flash"
glm.done     prompt_len=<字符数>   duration_ms=<耗时>   response="<GLM完整返回>"
glm.error    prompt_len=<字符数>   error="<错误信息>"
```

#### routers/text.py

```
text.intent   intent="record"|"query"
text.record   amount=<金额>   category="<分类>"
text.query    sql_len=<SQL字符数>
text.error    error="<错误信息>"
```

### 6. 开发输出示例

```
2026-04-03 10:00:01.123 [info ]  services.tencent  asr.start    audio_len=18432
2026-04-03 10:00:01.445 [info ]  services.tencent  asr.done     audio_len=18432  duration_ms=322  result="买咖啡花了30块钱。"
2026-04-03 10:00:01.446 [info ]  routers.text      text.intent  intent="record"
2026-04-03 10:00:02.660 [info ]  services.glm      glm.done     prompt_len=85  duration_ms=1214  response="{\"amount\":30,...}"
2026-04-03 10:00:02.661 [info ]  routers.text      text.record  amount=30.0  category="餐饮"
```

### 7. 生产输出示例

```json
{"event":"asr.done","level":"info","timestamp":"2026-04-03T10:00:01.445Z","module":"services.tencent","audio_len":18432,"duration_ms":322,"result":"买咖啡花了30块钱。"}
```

---

## 不在本次范围内

- request_id 注入（middleware 级别上下文绑定）
- 日志文件输出（当前只输出到 stdout）
- 日志采样或限流
- 前端日志集成

---

## 验收标准

1. `APP_ENV=dev` 时，启动服务后终端输出彩色格式化文本，含模块名和毫秒时间戳
2. `APP_ENV=prod` 时，输出单行 JSON
3. 调用 `/record-asr` 后，日志中出现 `asr.start` → `asr.done`，含 `result` 字段
4. 调用 `/record-ocr` 后，日志中出现 `ocr.done` → `ocr.parsed`，含 `amount`/`merchant`
5. `LOG_LEVEL=WARNING` 时，`info` 级别日志不输出

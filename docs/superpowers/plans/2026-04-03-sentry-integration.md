# Sentry 集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Learning 模式说明**：本计划中所有 Python 代码由用户亲自编写，Claude 提供指导和审查。每个 Task 的代码示例是参考，请自行输入，不要复制粘贴。

**Goal:** 为 FastAPI 后端接入 Sentry，实现错误追踪 + 性能监控（Custom Spans），并过滤 base64 敏感数据。

**Architecture:** 通过 `sentry-sdk[fastapi]` 官方集成，在 `lifespan` 中初始化 Sentry；用 `before_send` 钩子过滤 base64 字段；在 `services/tencent.py` 和 `services/glm.py` 中手动添加 custom span 追踪外部 API 耗时。

**Tech Stack:** sentry-sdk[fastapi], pydantic-settings, Python 3.13, FastAPI 0.135+

---

## 文件变更清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `pyproject.toml` | 修改 | 新增 sentry-sdk 依赖 |
| `.env` | 修改 | 新增 SENTRY_DSN、SENTRY_TRACES_SAMPLE_RATE |
| `.env.example` | 修改 | 同步更新示例文件 |
| `config.py` | 修改 | 新增 sentry 配置字段 |
| `main.py` | 修改 | Sentry 初始化 + lifespan + before_send 钩子 |
| `services/tencent.py` | 修改 | ASR/OCR 调用加 custom span |
| `services/glm.py` | 修改 | GLM 调用加 custom span |
| `tests/test_sentry_scrub.py` | 新建 | before_send 脱敏逻辑单元测试 |

---

## Task 1：注册 Sentry 并获取 DSN

**Files:**
- 无代码文件，只需操作 sentry.io

- [ ] **Step 1：访问 sentry.io 注册/登录**

  打开 https://sentry.io，注册账号或登录已有账号。

- [ ] **Step 2：创建新项目**

  - 点击 "Create Project"
  - 平台选择：**Python → FastAPI**
  - 项目名：`coco-backend`（或你喜欢的名字）

- [ ] **Step 3：复制 DSN**

  创建完成后，页面会显示 DSN，格式如：
  ```
  https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxxxxx.ingest.sentry.io/xxxxxxx
  ```
  复制并保存，下一步用。

---

## Task 2：安装依赖 + 配置环境变量

**Files:**
- Modify: `apps/backend/pyproject.toml`
- Modify: `apps/backend/.env`
- Modify: `apps/backend/.env.example`

- [ ] **Step 1：安装 sentry-sdk**

  ```bash
  cd apps/backend
  uv add "sentry-sdk[fastapi]"
  ```

  预期输出：`pyproject.toml` 中出现 `sentry-sdk[fastapi]>=x.x.x`，`uv.lock` 更新。

- [ ] **Step 2：在 `.env` 中添加 Sentry 配置**

  打开 `apps/backend/.env`，在文件末尾追加：
  ```
  # Sentry
  SENTRY_DSN=https://你的DSN
  SENTRY_TRACES_SAMPLE_RATE=1.0
  ```

- [ ] **Step 3：同步更新 `.env.example`**

  打开 `apps/backend/.env.example`，末尾追加：
  ```
  # Sentry（可选，不填则禁用）
  SENTRY_DSN=
  SENTRY_TRACES_SAMPLE_RATE=1.0
  ```

- [ ] **Step 4：提交**

  ```bash
  git add apps/backend/pyproject.toml apps/backend/uv.lock apps/backend/.env.example
  git commit -m "chore(backend): 安装 sentry-sdk[fastapi] 依赖"
  ```

  注意：`.env` 不提交（已在 .gitignore 中）。

---

## Task 3：更新 config.py

**Files:**
- Modify: `apps/backend/config.py`

当前 `config.py` 内容：
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    glm_api_key: str
    tencent_secret_id: str
    tencent_secret_key: str
    supabase_url: str
    supabase_service_role_key: str

settings = Settings()
```

- [ ] **Step 1：在 Settings 类末尾新增两个 Sentry 字段**

  在 `supabase_service_role_key: str` 下方添加：
  ```python
  # Sentry（可选）
  sentry_dsn: str | None = None
  sentry_traces_sample_rate: float = 1.0
  ```

  注意：
  - `str | None = None` 是 Python 3.10+ 的写法（项目规范禁止用 `Optional[str]`）
  - `= None` 是默认值，不填 .env 也不会报错

- [ ] **Step 2：验证配置可加载**

  ```bash
  cd apps/backend
  python -c "from config import settings; print(settings.sentry_dsn)"
  ```

  预期输出：你在 `.env` 中填的 DSN 字符串（或 `None` 如果没填）。

- [ ] **Step 3：提交**

  ```bash
  git add apps/backend/config.py
  git commit -m "feat(backend): config 新增 sentry_dsn 和 sentry_traces_sample_rate 字段"
  ```

---

## Task 4：实现 scrub_request_data + 单元测试

**Files:**
- Create: `apps/backend/tests/__init__.py`
- Create: `apps/backend/tests/test_sentry_scrub.py`
- Modify: `apps/backend/main.py`（只添加函数，不动其他部分）

先写测试，再写实现（TDD）。

- [ ] **Step 1：安装 pytest**

  ```bash
  cd apps/backend
  uv add --dev pytest
  ```

- [ ] **Step 2：创建 tests 目录和 __init__.py**

  ```bash
  mkdir apps/backend/tests
  touch apps/backend/tests/__init__.py
  ```

- [ ] **Step 3：写测试文件 `tests/test_sentry_scrub.py`**

  创建文件，写以下三个测试用例（请自行输入）：

  ```python
  import sys
  import os
  sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

  from main import scrub_request_data


  def test_filters_base64_fields():
      """base64 字段应被替换为长度信息"""
      event = {
          "request": {
              "data": {
                  "audioBase64": "AABBCC",   # 6 个字节
                  "text": "hello",
              }
          }
      }
      result = scrub_request_data(event, {})
      assert result["request"]["data"]["audioBase64"] == "[filtered, len=6]"
      assert result["request"]["data"]["text"] == "hello"


  def test_filters_image_base64():
      """imageBase64 也应被过滤"""
      event = {
          "request": {
              "data": {"imageBase64": "XXXX"}
          }
      }
      result = scrub_request_data(event, {})
      assert result["request"]["data"]["imageBase64"] == "[filtered, len=4]"


  def test_handles_missing_request_data():
      """event 中没有 request.data 时不应报错"""
      event = {"type": "error", "exception": {}}
      result = scrub_request_data(event, {})
      assert result == {"type": "error", "exception": {}}


  def test_handles_non_dict_request_data():
      """request.data 是字符串时直接跳过，不报错"""
      event = {"request": {"data": "raw body string"}}
      result = scrub_request_data(event, {})
      assert result["request"]["data"] == "raw body string"
  ```

- [ ] **Step 4：运行测试，确认全部失败（函数还不存在）**

  ```bash
  cd apps/backend
  python -m pytest tests/test_sentry_scrub.py -v
  ```

  预期：`ImportError: cannot import name 'scrub_request_data' from 'main'`

- [ ] **Step 5：在 `main.py` 中实现 scrub_request_data**

  在 `main.py` 的 import 区之后、`app = FastAPI(...)` 之前，添加这个函数：

  ```python
  def scrub_request_data(event: dict, hint: dict) -> dict:
      """before_send 钩子：将 base64 字段替换为长度信息"""
      data = event.get("request", {}).get("data", {})
      if not isinstance(data, dict):
          return event
      for key, value in data.items():
          if key.endswith("Base64") and isinstance(value, str):
              data[key] = f"[filtered, len={len(value.encode())}]"
      return event
  ```

  注意：`len(value.encode())` 计算字节长度（UTF-8），和规范保持一致。

- [ ] **Step 6：再次运行测试，确认全部通过**

  ```bash
  cd apps/backend
  python -m pytest tests/test_sentry_scrub.py -v
  ```

  预期：
  ```
  tests/test_sentry_scrub.py::test_filters_base64_fields PASSED
  tests/test_sentry_scrub.py::test_filters_image_base64 PASSED
  tests/test_sentry_scrub.py::test_handles_missing_request_data PASSED
  tests/test_sentry_scrub.py::test_handles_non_dict_request_data PASSED
  4 passed
  ```

- [ ] **Step 7：提交**

  ```bash
  git add apps/backend/tests/ apps/backend/main.py
  git commit -m "feat(backend): 实现 scrub_request_data 函数并添加单元测试"
  ```

---

## Task 5：更新 main.py — lifespan + Sentry 初始化

**Files:**
- Modify: `apps/backend/main.py`

当前 `main.py` 没有使用 lifespan。需要：
1. 添加 `lifespan` 函数（在其中初始化 Sentry）
2. 把 `app = FastAPI(title="CoCo backend")` 改为带 `lifespan=lifespan` 的版本

- [ ] **Step 1：在 main.py 顶部添加必要 import**

  在现有 import 下方追加：
  ```python
  from contextlib import asynccontextmanager

  import sentry_sdk
  from sentry_sdk.integrations.fastapi import FastApiIntegration

  from config import settings
  ```

  注意：`from config import settings` 如果已存在则跳过。

- [ ] **Step 2：在 scrub_request_data 函数之后添加 lifespan**

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
  ```

- [ ] **Step 3：修改 app 声明，加入 lifespan**

  将：
  ```python
  app = FastAPI(title="CoCo backend")
  ```
  改为：
  ```python
  app = FastAPI(title="CoCo backend", lifespan=lifespan)
  ```

- [ ] **Step 4：启动服务，验证不报错**

  ```bash
  cd apps/backend
  uvicorn main:app --reload
  ```

  预期：服务正常启动，无 Sentry 相关报错。控制台中不应出现 `sentry_sdk` 的 warning。

- [ ] **Step 5：验证 Sentry 收到心跳**

  访问 http://localhost:8000/health，然后打开 Sentry Dashboard 的 Performance 页面。
  应能看到一条 `GET /health` transaction（可能有几秒延迟）。

- [ ] **Step 6：提交**

  ```bash
  git add apps/backend/main.py
  git commit -m "feat(backend): 集成 Sentry 初始化，使用 lifespan + before_send 脱敏"
  ```

---

## Task 6：services/tencent.py — 添加 Custom Spans

**Files:**
- Modify: `apps/backend/services/tencent.py`

- [ ] **Step 1：在文件顶部添加 import**

  在现有 import 下方追加：
  ```python
  import sentry_sdk
  ```

- [ ] **Step 2：为 recognize_speech 添加 span**

  将原来的：
  ```python
  response = client.SentenceRecognition(request)
  return response.Result or ""
  ```
  改为用 span 包裹：
  ```python
  with sentry_sdk.start_span(op="tencent.asr", description="SentenceRecognition") as span:
      span.set_data("audio_len", len(audio_base64.encode()))
      response = client.SentenceRecognition(request)
  return response.Result or ""
  ```

- [ ] **Step 3：为 recognize_receipt 添加 span**

  将原来的：
  ```python
  response = client.GeneralAccurateOCR(request)
  return "\n".join(det.DetectedText for det in (response.TextDetections or []))
  ```
  改为：
  ```python
  with sentry_sdk.start_span(op="tencent.ocr", description="GeneralAccurateOCR") as span:
      span.set_data("image_len", len(image_base64.encode()))
      response = client.GeneralAccurateOCR(request)
  return "\n".join(det.DetectedText for det in (response.TextDetections or []))
  ```

- [ ] **Step 4：验证服务启动正常**

  ```bash
  cd apps/backend
  uvicorn main:app --reload
  ```

  预期：无报错。

- [ ] **Step 5：提交**

  ```bash
  git add apps/backend/services/tencent.py
  git commit -m "feat(backend): tencent service 添加 ASR/OCR custom spans"
  ```

---

## Task 7：services/glm.py — 添加 Custom Span

**Files:**
- Modify: `apps/backend/services/glm.py`

- [ ] **Step 1：在文件顶部添加 import**

  ```python
  import sentry_sdk
  ```

- [ ] **Step 2：为 call_glm 添加 span**

  `call_glm` 是 async 函数。`sentry_sdk.start_span()` 是普通上下文管理器，在 async 函数中同样适用。

  将 `async with httpx.AsyncClient() as client:` 外层包裹 span：

  ```python
  async def call_glm(prompt: str) -> str:
      with sentry_sdk.start_span(op="glm.chat", description="GLM Chat Completion") as span:
          span.set_data("prompt_len", len(prompt))
          span.set_data("model", "glm-4.7-flash")
          async with httpx.AsyncClient() as client:
              response = await client.post(
                  "https://open.bigmodel.cn/api/paas/v4/chat/completions",
                  headers={"Authorization": f"Bearer {settings.glm_api_key}"},
                  json={
                      "model": "glm-4.7-flash",
                      "messages": [{"role": "user", "content": prompt}],
                  },
                  timeout=30,
              )
              response.raise_for_status()
              return response.json()["choices"][0]["message"]["content"]
  ```

  注意：只追踪 `prompt_len` 和 `model`，不上报 prompt 内容本身。

- [ ] **Step 3：运行所有测试，确认不影响现有代码**

  ```bash
  cd apps/backend
  python -m pytest tests/ -v
  ```

  预期：4 passed，0 failed。

- [ ] **Step 4：提交**

  ```bash
  git add apps/backend/services/glm.py
  git commit -m "feat(backend): glm service 添加 GLM chat custom span"
  ```

---

## Task 8：端到端验证

- [ ] **Step 1：启动服务**

  ```bash
  cd apps/backend
  uvicorn main:app --reload
  ```

- [ ] **Step 2：验证验收标准 1 — DSN 为 None 时正常启动**

  临时注释 `.env` 中的 `SENTRY_DSN`，重启服务，确认无报错，`/health` 返回 `{"status": "ok"}`。
  验证完后还原注释。

- [ ] **Step 3：验证验收标准 2 — transaction 正常上报**

  用 curl 调用 `/health`：
  ```bash
  curl http://localhost:8000/health
  ```
  等 5-10 秒后，打开 Sentry → Performance，应看到 `GET /health` transaction。

- [ ] **Step 4：验证验收标准 3 — span 正常上报**

  调用 ASR 接口（需要真实 base64 音频或 mock 数据）。
  在 Sentry → Performance 中找到对应 transaction，展开查看是否有 `tencent.asr` span。

- [ ] **Step 5：验证验收标准 4 — base64 脱敏**

  在 Sentry → Issues 或某条 transaction 的 Request 详情中，
  确认 `audioBase64` 显示为 `[filtered, len=xxx]` 而非原始内容。

- [ ] **Step 6：验证验收标准 5 — 异常捕获**

  临时在 `routers/asr.py` 中添加 `raise ValueError("test sentry error")`，
  调用 `/record-asr`，确认 Sentry Issues 中出现该错误，且堆栈完整。
  验证完后删除该行。

- [ ] **Step 7：最终提交**

  ```bash
  git add .
  git commit -m "docs: 更新 README，记录 Sentry 环境变量配置方式"
  ```

  （如果 README 有 Environment Variables 章节，需同步更新）

---

## 验收标准回顾

| # | 标准 | 验证方式 |
|---|------|----------|
| 1 | 不填 DSN 时服务正常启动 | Task 8 Step 2 |
| 2 | 填入 DSN 后 transaction 上报 | Task 8 Step 3 |
| 3 | tencent.asr span 包含 audio_len | Task 8 Step 4 |
| 4 | audioBase64 显示为 `[filtered, len=xxx]` | Task 8 Step 5 |
| 5 | 异常被捕获并展示完整堆栈 | Task 8 Step 6 |

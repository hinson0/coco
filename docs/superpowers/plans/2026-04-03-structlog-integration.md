# structlog 结构化日志集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Learning 模式说明**：所有 Python 代码由用户亲自编写，Claude 提供指导和审查。代码块是参考，请自行输入。

**Goal:** 为 FastAPI 后端接入 structlog，在 service 和 router 层记录 ASR/OCR/GLM 调用的元信息、耗时和结果，开发环境彩色文本、生产环境 JSON。

**Architecture:** 新建 `logging_config.py` 集中管理 processors 链，`main.py` 的 lifespan 一次性初始化；services 用 `structlog.get_logger()` 记录 start/done/error；routers 记录解析后的业务结果。

**Tech Stack:** structlog, Python 3.13, FastAPI 0.135+, pydantic-settings

---

## 文件变更清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `apps/backend/pyproject.toml` | 修改 | 新增 structlog、pytest 依赖 |
| `apps/backend/.env` | 修改 | 新增 APP_ENV、LOG_LEVEL |
| `apps/backend/.env.example` | 修改 | 同步更新示例 |
| `apps/backend/config.py` | 修改 | 新增 app_env、log_level 字段 |
| `apps/backend/logging_config.py` | **新建** | setup_logging() 函数 |
| `apps/backend/main.py` | 修改 | lifespan 调用 setup_logging() |
| `apps/backend/services/tencent.py` | 修改 | ASR/OCR start/done/error 日志 |
| `apps/backend/services/glm.py` | 修改 | GLM start/done/error 日志 |
| `apps/backend/routers/ocr.py` | 修改 | ocr.parsed/no_amount/empty 日志 |
| `apps/backend/routers/text.py` | 修改 | text.intent/record/query 日志 |
| `apps/backend/tests/test_logging_config.py` | **新建** | setup_logging 单元测试 |

---

## Task 1：安装依赖 + 配置环境变量

**Files:**
- Modify: `apps/backend/pyproject.toml`
- Modify: `apps/backend/.env`
- Modify: `apps/backend/.env.example`

- [ ] **Step 1：安装 structlog 和 pytest**

  ```bash
  cd apps/backend
  uv add structlog
  uv add --dev pytest
  ```

  预期：`pyproject.toml` 的 `dependencies` 出现 `structlog>=xx`，`[tool.uv.dev-dependencies]` 或 `[dependency-groups]` 出现 `pytest`。

- [ ] **Step 2：在 `.env` 末尾追加配置**

  打开 `apps/backend/.env`，添加：
  ```
  # Logging
  APP_ENV=dev
  LOG_LEVEL=DEBUG
  ```

- [ ] **Step 3：更新 `.env.example`**

  打开 `apps/backend/.env.example`，末尾追加：
  ```
  # Logging
  APP_ENV=dev          # dev | prod
  LOG_LEVEL=DEBUG      # DEBUG | INFO | WARNING
  ```

- [ ] **Step 4：提交**

  ```bash
  git add apps/backend/pyproject.toml apps/backend/uv.lock apps/backend/.env.example
  git commit -m "chore(backend): 安装 structlog 依赖"
  ```

---

## Task 2：更新 config.py

**Files:**
- Modify: `apps/backend/config.py`

当前文件内容（参考）：
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

- [ ] **Step 1：在 Settings 类末尾添加两个字段**

  在 `supabase_service_role_key: str` 下方添加：
  ```python
  # Logging
  app_env: str = "dev"
  log_level: str = "DEBUG"
  ```

- [ ] **Step 2：验证加载正常**

  ```bash
  cd apps/backend
  python -c "from config import settings; print(settings.app_env, settings.log_level)"
  ```

  预期输出：`dev DEBUG`

- [ ] **Step 3：提交**

  ```bash
  git add apps/backend/config.py
  git commit -m "feat(backend): config 新增 app_env 和 log_level 字段"
  ```

---

## Task 3：创建 logging_config.py（TDD）

**Files:**
- Create: `apps/backend/logging_config.py`
- Create: `apps/backend/tests/__init__.py`
- Create: `apps/backend/tests/test_logging_config.py`

先写测试，再写实现。

- [ ] **Step 1：创建 tests 目录**

  ```bash
  mkdir -p apps/backend/tests
  touch apps/backend/tests/__init__.py
  ```

- [ ] **Step 2：创建测试文件 `tests/test_logging_config.py`**

  写以下内容（请自行输入）：

  ```python
  import json
  import sys
  import os

  import pytest
  import structlog

  sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

  from logging_config import setup_logging


  @pytest.fixture(autouse=True)
  def reset_structlog():
      """每个测试后重置 structlog 全局状态，避免测试间干扰"""
      yield
      structlog.reset_defaults()


  def test_prod_outputs_json(capsys):
      """prod 模式应输出合法 JSON，含 event、level、timestamp 字段"""
      setup_logging("prod", "DEBUG")
      log = structlog.get_logger()
      log.info("test.event", value=42)
      captured = capsys.readouterr()
      data = json.loads(captured.out.strip())
      assert data["event"] == "test.event"
      assert data["value"] == 42
      assert data["level"] == "info"
      assert "timestamp" in data


  def test_level_filtering_suppresses_info(capsys):
      """LOG_LEVEL=WARNING 时，info 级别日志不应出现在输出中"""
      setup_logging("prod", "WARNING")
      log = structlog.get_logger()
      log.info("should.not.appear")
      log.warning("should.appear")
      captured = capsys.readouterr()
      assert "should.not.appear" not in captured.out
      assert "should.appear" in captured.out


  def test_dev_mode_does_not_crash(capsys):
      """dev 模式调用不应抛出异常"""
      setup_logging("dev", "DEBUG")
      log = structlog.get_logger()
      log.info("dev.test", key="value")
      captured = capsys.readouterr()
      assert "dev.test" in captured.out
  ```

- [ ] **Step 3：运行测试，确认全部失败**

  ```bash
  cd apps/backend
  python -m pytest tests/test_logging_config.py -v
  ```

  预期：`ImportError: No module named 'logging_config'`

- [ ] **Step 4：创建 `logging_config.py`，实现 setup_logging()**

  创建 `apps/backend/logging_config.py`，写以下内容：

  ```python
  import logging

  import structlog
  from structlog.processors import CallsiteParameter, CallsiteParameterAdder


  def setup_logging(env: str = "dev", level: str = "DEBUG") -> None:
      """配置全局 structlog。在 lifespan 启动时调用一次。"""
      log_level = getattr(logging, level.upper(), logging.DEBUG)

      shared_processors = [
          structlog.stdlib.add_log_level,
          structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S.%f", utc=False),
          CallsiteParameterAdder([CallsiteParameter.MODULE]),
          structlog.processors.StackInfoRenderer(),
      ]

      if env == "prod":
          renderer = structlog.processors.JSONRenderer()
      else:
          renderer = structlog.dev.ConsoleRenderer(colors=True)

      structlog.configure(
          processors=shared_processors + [renderer],
          wrapper_class=structlog.make_filtering_bound_logger(log_level),
          context_class=dict,
          logger_factory=structlog.PrintLoggerFactory(),
      )

      logging.basicConfig(level=log_level)
  ```

- [ ] **Step 5：再次运行测试，确认全部通过**

  ```bash
  cd apps/backend
  python -m pytest tests/test_logging_config.py -v
  ```

  预期：
  ```
  tests/test_logging_config.py::test_prod_outputs_json PASSED
  tests/test_logging_config.py::test_level_filtering_suppresses_info PASSED
  tests/test_logging_config.py::test_dev_mode_does_not_crash PASSED
  3 passed
  ```

- [ ] **Step 6：提交**

  ```bash
  git add apps/backend/logging_config.py apps/backend/tests/
  git commit -m "feat(backend): 新增 logging_config.py，setup_logging 支持 dev/prod 双模式"
  ```

---

## Task 4：更新 main.py — lifespan + setup_logging

**Files:**
- Modify: `apps/backend/main.py`

当前 `main.py`：
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import all_routers

app = FastAPI(title="CoCo backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(all_routers)

@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 1：在顶部添加 import**

  在现有 import 下方追加：
  ```python
  from contextlib import asynccontextmanager

  from config import settings
  from logging_config import setup_logging
  ```

- [ ] **Step 2：在 import 区之后、app 声明之前，添加 lifespan**

  ```python
  @asynccontextmanager
  async def lifespan(app: FastAPI):
      setup_logging(settings.app_env, settings.log_level)
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

- [ ] **Step 4：启动服务验证**

  ```bash
  cd apps/backend
  uvicorn main:app --reload
  ```

  预期：终端出现彩色日志（dev 模式），访问 http://localhost:8000/health 后无报错。

- [ ] **Step 5：提交**

  ```bash
  git add apps/backend/main.py
  git commit -m "feat(backend): main.py 添加 lifespan，启动时初始化 structlog"
  ```

---

## Task 5：services/tencent.py — ASR/OCR 日志

**Files:**
- Modify: `apps/backend/services/tencent.py`

当前文件关键部分：
```python
def recognize_speech(audio_base64: str) -> str:
    client = asr_client.AsrClient(_get_cred(), "ap-guangzhou")
    request = asr_models.SentenceRecognitionRequest()
    request.EngSerViceType = "16k_zh"
    request.SourceType = 1
    request.VoiceFormat = "m4a"
    request.Data = audio_base64
    request.DataLen = len(audio_base64.encode())
    response = client.SentenceRecognition(request)
    return response.Result or ""

def recognize_receipt(image_base64: str) -> str:
    client = ocr_client.OcrClient(_get_cred(), "ap-guangzhou")
    request = ocr_models.GeneralAccurateOCRRequest()
    request.ImageBase64 = image_base64
    response = client.GeneralAccurateOCR(request)
    return "\n".join(det.DetectedText for det in (response.TextDetections or []))
```

- [ ] **Step 1：在顶部添加 import**

  在现有 import 下方追加：
  ```python
  import time

  import structlog

  log = structlog.get_logger()
  ```

- [ ] **Step 2：改写 recognize_speech，加入日志**

  将整个函数改写为：
  ```python
  def recognize_speech(audio_base64: str) -> str:
      "ASR服务"
      audio_len = len(audio_base64.encode())
      log.info("asr.start", audio_len=audio_len)
      start = time.monotonic()
      try:
          client = asr_client.AsrClient(_get_cred(), "ap-guangzhou")
          request = asr_models.SentenceRecognitionRequest()
          request.EngSerViceType = "16k_zh"
          request.SourceType = 1
          request.VoiceFormat = "m4a"
          request.Data = audio_base64
          request.DataLen = audio_len
          response = client.SentenceRecognition(request)
          result = response.Result or ""
          duration_ms = round((time.monotonic() - start) * 1000)
          log.info("asr.done", audio_len=audio_len, duration_ms=duration_ms, result=result)
          return result
      except Exception as e:
          log.error("asr.error", audio_len=audio_len, error=str(e))
          raise
  ```

- [ ] **Step 3：改写 recognize_receipt，加入日志**

  ```python
  def recognize_receipt(image_base64: str) -> str:
      "OCR服务"
      image_len = len(image_base64.encode())
      log.info("ocr.start", image_len=image_len)
      start = time.monotonic()
      try:
          client = ocr_client.OcrClient(_get_cred(), "ap-guangzhou")
          request = ocr_models.GeneralAccurateOCRRequest()
          request.ImageBase64 = image_base64
          response = client.GeneralAccurateOCR(request)
          raw_text = "\n".join(det.DetectedText for det in (response.TextDetections or []))
          duration_ms = round((time.monotonic() - start) * 1000)
          log.info("ocr.done", image_len=image_len, duration_ms=duration_ms, raw_len=len(raw_text.encode()))
          return raw_text
      except Exception as e:
          log.error("ocr.error", image_len=image_len, error=str(e))
          raise
  ```

- [ ] **Step 4：运行现有测试，确认不受影响**

  ```bash
  cd apps/backend
  python -m pytest tests/ -v
  ```

  预期：3 passed（test_logging_config 的测试），无 failed。

- [ ] **Step 5：提交**

  ```bash
  git add apps/backend/services/tencent.py
  git commit -m "feat(backend): tencent service 添加 ASR/OCR start/done/error 日志"
  ```

---

## Task 6：services/glm.py — GLM 日志

**Files:**
- Modify: `apps/backend/services/glm.py`

当前 `call_glm` 函数：
```python
async def call_glm(prompt: str) -> str:
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

- [ ] **Step 1：在顶部添加 import**

  在 `import json` 下方追加：
  ```python
  import time

  import structlog

  log = structlog.get_logger()
  ```

- [ ] **Step 2：改写 call_glm，加入日志**

  ```python
  async def call_glm(prompt: str) -> str:
      prompt_len = len(prompt)
      log.info("glm.start", prompt_len=prompt_len, model="glm-4.7-flash")
      start = time.monotonic()
      try:
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
              result = response.json()["choices"][0]["message"]["content"]
          duration_ms = round((time.monotonic() - start) * 1000)
          log.info("glm.done", prompt_len=prompt_len, duration_ms=duration_ms, response=result)
          return result
      except Exception as e:
          log.error("glm.error", prompt_len=prompt_len, error=str(e))
          raise
  ```

- [ ] **Step 3：提交**

  ```bash
  git add apps/backend/services/glm.py
  git commit -m "feat(backend): glm service 添加 GLM start/done/error 日志"
  ```

---

## Task 7：routers/ocr.py — OCR 解析结果日志

**Files:**
- Modify: `apps/backend/routers/ocr.py`

在 `record_ocr` 路由函数里，OCR 调用完并解析后，根据三种结果分别打日志：

- [ ] **Step 1：在顶部添加 import**

  在 `from fastapi import APIRouter` 下方追加：
  ```python
  import structlog

  log = structlog.get_logger()
  ```

- [ ] **Step 2：在 record_ocr 函数中添加三处日志**

  当前 `record_ocr` 函数的三个分支：

  **分支 1**（OCR 返回空，`not ocr_text.strip()`）：
  在 `return OcrResponse(data=OcrErrorData(...))` 之前添加：
  ```python
  log.warning("ocr.empty")
  ```

  **分支 2**（识别到金额，返回 `OcrBillData`）：
  在 `return OcrResponse(data=data)` 之前添加：
  ```python
  log.info("ocr.parsed",
      amount=info["amount"],
      merchant=info["merchant"],
      date=info["date"],
  )
  ```

  **分支 3**（有文字但无金额，返回 `OcrTextData`）：
  在 `return OcrResponse(data=data)` 之前添加：
  ```python
  log.info("ocr.no_amount", ocr_text_len=len(ocr_text.encode()))
  ```

- [ ] **Step 3：提交**

  ```bash
  git add apps/backend/routers/ocr.py
  git commit -m "feat(backend): ocr router 添加解析结果日志"
  ```

---

## Task 8：routers/text.py — 文本意图/记账/查询日志

**Files:**
- Modify: `apps/backend/routers/text.py`

- [ ] **Step 1：在顶部添加 import**

  在 `from fastapi import APIRouter, HTTPException, Request` 下方追加：
  ```python
  import structlog

  log = structlog.get_logger()
  ```

- [ ] **Step 2：在 record_text 函数中添加四处日志**

  **意图识别后**（`intent = "query"` or `"record"` 确定之后）：
  ```python
  log.info("text.intent", intent=intent)
  ```

  **记账成功后**（`return TextResponse(data=TextBillData(...))` 之前）：
  ```python
  log.info("text.record",
      amount=float(parsed["amount"]),
      category=str(parsed.get("category", "其他支出")),
  )
  ```

  **查询成功后**（`return TextResponse(data=TextNlData(...))` 之前）：
  ```python
  log.info("text.query", sql_len=len(sql))
  ```

  **查询出错后**（`return TextResponse(data=TextErrorData(...))` 之前，在 `except Exception:` 块中）：
  ```python
  log.error("text.error", error="查询出错")
  ```

- [ ] **Step 3：提交**

  ```bash
  git add apps/backend/routers/text.py
  git commit -m "feat(backend): text router 添加意图/记账/查询日志"
  ```

---

## Task 9：端到端验证

- [ ] **Step 1：运行所有单元测试**

  ```bash
  cd apps/backend
  python -m pytest tests/ -v
  ```

  预期：3 passed，0 failed。

- [ ] **Step 2：启动服务（dev 模式）**

  ```bash
  cd apps/backend
  uvicorn main:app --reload
  ```

- [ ] **Step 3：验证验收标准 1 — dev 模式彩色输出**

  终端应输出类似：
  ```
  2026-04-03 10:00:01.123 [info ]  main  ...
  ```
  含模块名、毫秒时间戳、彩色 level。

- [ ] **Step 4：验证验收标准 2 — prod 模式 JSON 输出**

  修改 `.env` 的 `APP_ENV=prod`，重启服务，访问 `/health`。
  输出应为单行 JSON。验证完后改回 `APP_ENV=dev`。

- [ ] **Step 5：验证验收标准 3 — ASR 日志链**

  调用 `/record-asr`（需要真实或 mock 的 base64 音频）。
  终端应出现：
  ```
  asr.start   audio_len=...
  asr.done    audio_len=...  duration_ms=...  result="..."
  ```

- [ ] **Step 6：验证验收标准 4 — OCR 日志链**

  调用 `/record-ocr`（需要小票图片 base64）。
  终端应出现：
  ```
  ocr.start   image_len=...
  ocr.done    image_len=...  duration_ms=...  raw_len=...
  ocr.parsed  amount=...  merchant="..."  date="..."
  ```

- [ ] **Step 7：验证验收标准 5 — LOG_LEVEL=WARNING 过滤**

  修改 `.env` 的 `LOG_LEVEL=WARNING`，重启服务，调用任意接口。
  `info` 级别日志不应出现。验证完后改回 `LOG_LEVEL=DEBUG`。

- [ ] **Step 8：最终提交**

  ```bash
  git add apps/backend/.env.example
  git commit -m "docs(backend): 更新 .env.example，记录 APP_ENV/LOG_LEVEL 配置说明"
  ```

---

## 验收标准回顾

| # | 标准 | 验证方式 |
|---|------|----------|
| 1 | dev 模式输出彩色文本含模块名和毫秒时间戳 | Task 9 Step 3 |
| 2 | prod 模式输出单行 JSON | Task 9 Step 4 |
| 3 | /record-asr 日志出现 asr.start→asr.done 含 result | Task 9 Step 5 |
| 4 | /record-ocr 日志出现 ocr.done→ocr.parsed 含 amount/merchant | Task 9 Step 6 |
| 5 | LOG_LEVEL=WARNING 时 info 日志不输出 | Task 9 Step 7 |

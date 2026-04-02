# FastAPI 后端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Python FastAPI 实现 3 个接口（/record-asr、/record-ocr、/record-text），完全替代原 Supabase Edge Functions。

**Architecture:** FastAPI 分层架构——`routers/` 处理 HTTP、`services/` 封装 AI 调用、`schemas/` 定义数据格式、`config.py` 集中管理环境变量。数据库查询通过 `supabase-py` 调用已有的 `exec_readonly_sql` RPC 函数。

**Tech Stack:** Python 3.12 · FastAPI · uv · supabase-py · tencentcloud-sdk-python · uvicorn（直接本地运行，不用 Docker）

---

> ⚠️ **Learning 模式：Python 代码 100% 由你亲自编写**，本计划提供代码示例供参考，你需要自己在编辑器里敲出来。

> ✅ **已完成（brainstorming 阶段）：** 目录结构创建、docker-compose.yml、apps/mobile/lib/api.ts 修改、死文件清理。

---

## 文件清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `apps/backend/pyproject.toml` | 创建 | uv 依赖管理 |
| `apps/backend/Dockerfile` | 编写 | 容器构建 |
| `apps/backend/config.py` | 编写 | 环境变量读取 |
| `apps/backend/main.py` | 编写 | FastAPI 入口 + CORS |
| `apps/backend/schemas/asr.py` | 创建 | ASR 请求/响应 schema |
| `apps/backend/schemas/ocr.py` | 创建 | OCR 请求/响应 schema |
| `apps/backend/schemas/text.py` | 创建 | Text 请求/响应 schema |
| `apps/backend/services/tencent.py` | 编写 | 腾讯云 ASR / OCR 调用 |
| `apps/backend/services/glm.py` | 编写 | GLM API 调用 + JSON 提取 |
| `apps/backend/routers/asr.py` | 编写 | POST /record-asr |
| `apps/backend/routers/ocr.py` | 编写 | POST /record-ocr |
| `apps/backend/routers/text.py` | 编写 | POST /record-text |

---

## Task 1：uv 初始化 + 依赖安装

**Files:**
- 创建：`apps/backend/pyproject.toml`（由 uv 生成）

- [ ] **Step 1：在 `apps/backend/` 目录下初始化 uv 项目**

```bash
cd apps/backend
uv init --no-readme
```

这会生成 `pyproject.toml`（类比 `package.json`）和 `.python-version`。

- [ ] **Step 2：安装所有依赖**

```bash
uv add fastapi uvicorn[standard] pydantic-settings supabase tencentcloud-sdk-python python-jose
```

各依赖用途：
- `fastapi` — Web 框架
- `uvicorn[standard]` — ASGI 服务器（运行 FastAPI 的）
- `pydantic-settings` — 从 `.env` 读取环境变量
- `supabase` — Supabase Python 客户端（`supabase-py`）
- `tencentcloud-sdk-python` — 腾讯云 ASR / OCR SDK
- `python-jose` — JWT 解码（从 Authorization header 取 user_id）

- [ ] **Step 3：确认 `pyproject.toml` 里有所有依赖，提交**

```bash
git add apps/backend/pyproject.toml apps/backend/uv.lock
git commit -m "chore(backend): uv 初始化，添加所有依赖"
```

---

## Task 2：本地启动验证

**本地直接用 uvicorn 跑，不用 Docker。**

- [ ] **Step 1：确认 `.env` 文件在 `apps/backend/` 下存在**

```
GLM_API_KEY=...
TENCENT_SECRET_ID=...
TENCENT_SECRET_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

- [ ] **Step 2：启动命令**

```bash
cd apps/backend
uv run uvicorn main:app --reload --port 8000
```

`--reload` 表示修改任何 `.py` 文件后自动重启，不需要手动停止重启。

- [ ] **Step 3：验证服务启动**

```bash
curl http://localhost:8000/health
```

预期：`{"status":"ok"}`

---

## Task 3：环境变量配置

**Files:**
- 编写：`apps/backend/config.py`

- [ ] **Step 1：编写 `config.py`**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    glm_api_key: str
    tencent_secret_id: str
    tencent_secret_key: str
    supabase_url: str
    supabase_service_role_key: str

    class Config:
        env_file = ".env"

settings = Settings()
```

**为什么用 `pydantic-settings`？** 启动时自动从 `.env` 读取并做类型校验。如果 `GLM_API_KEY` 没配，启动时立即报错，而不是运行到一半再崩。

- [ ] **Step 2：验证**

在 `apps/backend/` 目录下运行：

```bash
uv run python -c "from config import settings; print(settings.glm_api_key[:8])"
```

预期：打印出 `GLM_API_KEY` 的前 8 个字符（确认读到了 `.env`）。

- [ ] **Step 3：提交**

```bash
git add apps/backend/config.py
git commit -m "feat(backend): 环境变量配置（pydantic-settings）"
```

---

## Task 4：FastAPI 入口 + CORS

**Files:**
- 编写：`apps/backend/main.py`

- [ ] **Step 1：编写 `main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import asr, ocr, text

app = FastAPI(title="CoCo Backend")

# CORS：允许移动端（任何来源）调用
# 生产环境可替换 allow_origins=["*"] 为具体域名
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(asr.router)
app.include_router(ocr.router)
app.include_router(text.router)

@app.get("/health")
def health():
    return {"status": "ok"}
```

**为什么需要 CORS？** 移动端发起的 HTTP 请求，浏览器（以及某些 React Native 实现）会检查服务端是否允许跨域。没有 `CORSMiddleware`，请求会被浏览器拦截，服务端永远收不到。

- [ ] **Step 2：验证（先跑起来，router 可以先留空）**

先在每个 router 文件里写最简单的占位，让 `main.py` 能 import 成功：

`apps/backend/routers/asr.py`：
```python
from fastapi import APIRouter
router = APIRouter()
```

`apps/backend/routers/ocr.py` 和 `routers/text.py` 同上。

然后运行：
```bash
cd apps/backend
uv run uvicorn main:app --reload
```

访问 `http://localhost:8000/health`，预期返回 `{"status":"ok"}`。

- [ ] **Step 3：提交**

```bash
git add apps/backend/main.py apps/backend/routers/
git commit -m "feat(backend): FastAPI 入口 + CORS 配置"
```

---

## Task 5：Pydantic Schemas

**Files:**
- 创建：`apps/backend/schemas/asr.py`
- 创建：`apps/backend/schemas/ocr.py`
- 创建：`apps/backend/schemas/text.py`

Schema 定义接口的请求体和响应体格式，FastAPI 自动做校验和生成文档。

- [ ] **Step 1：编写 `schemas/asr.py`**

```python
from pydantic import BaseModel

class AsrRequest(BaseModel):
    audioBase64: str

class AsrData(BaseModel):
    asrText: str

class AsrResponse(BaseModel):
    data: AsrData
```

- [ ] **Step 2：编写 `schemas/ocr.py`**

```python
from pydantic import BaseModel
from typing import Optional

class OcrRequest(BaseModel):
    imageBase64: str

class Transaction(BaseModel):
    amount: float
    category: str
    note: str
    type: str          # "expense" | "income"
    occurred_at: str   # ISO 8601

class OcrBillData(BaseModel):
    type: str = "bill"
    transaction: Transaction

class OcrTextData(BaseModel):
    type: str = "ocr_text"
    ocrText: str
    merchant: Optional[str] = None

class OcrErrorData(BaseModel):
    type: str = "text"
    message: str

class OcrResponse(BaseModel):
    data: OcrBillData | OcrTextData | OcrErrorData
```

- [ ] **Step 3：编写 `schemas/text.py`**

```python
from pydantic import BaseModel
from typing import Optional
from schemas.ocr import Transaction

class TextRequest(BaseModel):
    text: str

class TextBillData(BaseModel):
    type: str = "bill"
    transaction: Transaction

class TextNlData(BaseModel):
    type: str = "nl_result"
    message: str

class TextErrorData(BaseModel):
    type: str = "text"
    message: str

class TextResponse(BaseModel):
    data: TextBillData | TextNlData | TextErrorData
```

- [ ] **Step 4：提交**

```bash
git add apps/backend/schemas/
git commit -m "feat(backend): Pydantic schemas（ASR / OCR / Text）"
```

---

## Task 6：腾讯云服务层

**Files:**
- 编写：`apps/backend/services/tencent.py`

- [ ] **Step 1：编写 `services/tencent.py`**

```python
from tencentcloud.common import credential
from tencentcloud.asr.v20190614 import asr_client, models as asr_models
from tencentcloud.ocr.v20181119 import ocr_client, models as ocr_models
from config import settings

def _get_cred():
    return credential.Credential(
        settings.tencent_secret_id,
        settings.tencent_secret_key
    )

def recognize_speech(audio_base64: str) -> str:
    """语音转文字（腾讯云 ASR）"""
    client = asr_client.AsrClient(_get_cred(), "ap-guangzhou")
    req = asr_models.SentenceRecognitionRequest()
    req.EngSerViceType = "16k_zh"
    req.SourceType = 1
    req.VoiceFormat = "m4a"
    req.Data = audio_base64
    req.DataLen = len(audio_base64.encode())
    resp = client.SentenceRecognition(req)
    return resp.Result or ""

def recognize_receipt(image_base64: str) -> str:
    """图片 OCR（腾讯云通用文字识别）"""
    client = ocr_client.OcrClient(_get_cred(), "ap-guangzhou")
    req = ocr_models.GeneralBasicOCRRequest()
    req.ImageBase64 = image_base64
    resp = client.GeneralBasicOCR(req)
    return "\n".join(
        det.DetectedText or ""
        for det in (resp.TextDetections or [])
    )
```

- [ ] **Step 2：提交**

```bash
git add apps/backend/services/tencent.py
git commit -m "feat(backend): 腾讯云 ASR / OCR 服务层"
```

---

## Task 7：GLM 服务层

**Files:**
- 编写：`apps/backend/services/glm.py`

- [ ] **Step 1：编写 `services/glm.py`**

```python
import json
import re
import httpx
from config import settings

async def call_glm(prompt: str) -> str:
    """调用 GLM API，返回原始文本"""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            headers={"Authorization": f"Bearer {settings.glm_api_key}"},
            json={
                "model": "glm-4-flash",
                "messages": [{"role": "user", "content": prompt}]
            },
            timeout=30.0
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

def extract_json(raw: str) -> dict | None:
    """从 GLM 返回文本中提取 JSON（兼容 markdown 代码块）"""
    code_block = re.search(r"```(?:json)?\s*\n?([\s\S]*?)\n?```", raw)
    json_str = code_block.group(1).strip() if code_block else raw.strip()
    # fallback：找第一个 {...}
    if not json_str.startswith("{"):
        match = re.search(r"\{[\s\S]*\}", json_str)
        json_str = match.group(0) if match else json_str
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        return None

def extract_sql(raw: str) -> str:
    """从 GLM 返回文本中提取 SQL"""
    code_block = re.search(r"```(?:sql)?\s*\n?([\s\S]*?)\n?```", raw)
    return code_block.group(1).strip() if code_block else raw.strip()
```

**为什么用 `httpx` 而不是 `requests`？** FastAPI 是异步框架（async/await），`requests` 是同步的，在 async 函数里用会阻塞整个服务器。`httpx` 支持 `async with`，不阻塞。

- [ ] **Step 2：提交**

```bash
git add apps/backend/services/glm.py
git commit -m "feat(backend): GLM 服务层（async httpx）"
```

---

## Task 8：ASR Router

**Files:**
- 编写：`apps/backend/routers/asr.py`

- [ ] **Step 1：编写 `routers/asr.py`**

```python
from fastapi import APIRouter, HTTPException
from schemas.asr import AsrRequest, AsrResponse, AsrData
from services.tencent import recognize_speech

router = APIRouter()

@router.post("/record-asr", response_model=AsrResponse)
def record_asr(body: AsrRequest):
    if not body.audioBase64:
        raise HTTPException(status_code=400, detail="Missing audioBase64")
    asr_text = recognize_speech(body.audioBase64)
    return AsrResponse(data=AsrData(asrText=asr_text))
```

- [ ] **Step 2：本地测试**

启动服务后用 curl 测试（用一个很短的 base64 字符串测通路即可）：

```bash
curl -X POST http://localhost:8000/record-asr \
  -H "Content-Type: application/json" \
  -d '{"audioBase64": "test"}'
```

预期：返回 JSON，格式为 `{"data": {"asrText": "..."}}` 或腾讯云报错（密钥配置正确时返回识别结果）。

- [ ] **Step 3：提交**

```bash
git add apps/backend/routers/asr.py
git commit -m "feat(backend): /record-asr 接口"
```

---

## Task 9：OCR Router

**Files:**
- 编写：`apps/backend/routers/ocr.py`

OCR 路由包含正则提取逻辑（从原 TypeScript `record-ocr/index.ts` 移植）。

- [ ] **Step 1：编写 `routers/ocr.py`**

```python
import re
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from schemas.ocr import OcrRequest, OcrResponse, OcrBillData, OcrTextData, OcrErrorData, Transaction
from services.tencent import recognize_receipt

router = APIRouter()

def extract_receipt_info(ocr_text: str) -> dict:
    """从 OCR 文本提取金额、商户、日期"""
    # 多模式依次尝试，取最后一次匹配（避免子合计误命中）
    amount_patterns = [
        r"[实应].{0,2}金额[：:]\s*([\d]+\.[\d]{2})",
        r"实.{0,2}付[：:]\s*([\d]+\.[\d]{2})",
        r"个人[账帐].{0,2}支付[：:]\s*([\d]+\.[\d]{2})",
        r"合计[：:]?\s*(?:\d+[件个张]\s*\n?)?([\d]+\.[\d]{2})",
        r"总计[：:]\s*([\d]+\.[\d]{2})",
        r"消费[：:]\s*([\d]+\.[\d]{2})",
        r"应收[：:]\s*([\d]+\.[\d]{2})",
        r"小计[：:]\s*([\d]+\.[\d]{2})",
    ]

    amount = None
    for pattern in amount_patterns:
        matches = list(re.finditer(pattern, ocr_text))
        if matches:
            val = float(matches[-1].group(1))
            if val > 0:
                amount = val
                break

    # 商户名：第一行有意义的文字
    lines = [l.strip() for l in ocr_text.split("\n")]
    lines = [l for l in lines if len(l) > 1 and not re.match(r"^[\d\s\-:.]+$", l)]
    merchant = lines[0] if lines else None

    # 日期
    iso_match = re.search(r"(\d{4})-(\d{2})-(\d{2})", ocr_text)
    dot_match = re.search(r"(\d{4})[.年](\d{1,2})[.月](\d{1,2})", ocr_text)
    date_match = iso_match or dot_match
    if date_match:
        y, m, d = date_match.group(1), date_match.group(2).zfill(2), date_match.group(3).zfill(2)
        date = f"{y}-{m}-{d}T00:00:00Z"
    else:
        date = None

    return {"amount": amount, "merchant": merchant, "date": date}

@router.post("/record-ocr", response_model=OcrResponse)
def record_ocr(body: OcrRequest):
    if not body.imageBase64:
        raise HTTPException(status_code=400, detail="Missing imageBase64")

    ocr_text = recognize_receipt(body.imageBase64)

    if not ocr_text.strip():
        return OcrResponse(data=OcrErrorData(
            message="无法识别小票内容，请确保图片清晰后重试。"
        ))

    info = extract_receipt_info(ocr_text)

    if info["amount"] and info["amount"] > 0:
        return OcrResponse(data=OcrBillData(
            transaction=Transaction(
                amount=info["amount"],
                category="购物",
                note=info["merchant"] or "",
                type="expense",
                occurred_at=info["date"] or datetime.now(timezone.utc).isoformat(),
            )
        ))

    return OcrResponse(data=OcrTextData(
        ocrText=ocr_text,
        merchant=info["merchant"],
    ))
```

- [ ] **Step 2：本地测试**

```bash
curl -X POST http://localhost:8000/record-ocr \
  -H "Content-Type: application/json" \
  -d '{"imageBase64": "test"}'
```

- [ ] **Step 3：提交**

```bash
git add apps/backend/routers/ocr.py
git commit -m "feat(backend): /record-ocr 接口 + 正则提取"
```

---

## Task 10：Text Router

**Files:**
- 编写：`apps/backend/routers/text.py`

- [ ] **Step 1：编写 prompts（放在 `routers/text.py` 顶部）**

```python
from datetime import datetime, timezone

def build_intent_prompt(text: str) -> str:
    return f"""判断以下用户输入的意图，返回 JSON：{{"intent": "record"}} 或 {{"intent": "query"}}。
- record：用户在描述一笔消费或收入
- query：用户在查询历史数据
只返回 JSON。
用户输入：{text}"""

def build_record_prompt(text: str) -> str:
    now = datetime.now(timezone.utc).isoformat()
    return f"""从以下文字提取记账信息，返回 JSON：
{{"amount": number, "category": string, "note": string, "occurred_at": string, "type": "expense"|"income"}}
分类选项：餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
当前时间：{now}
只返回 JSON。
文字：{text}"""

def build_query_prompt(question: str) -> str:
    now = datetime.now(timezone.utc).isoformat()
    return f"""将以下问题转为 PostgreSQL SELECT 查询。
表结构：
- transactions (id, user_id, category_id, amount, type, note, occurred_at, deleted_at)
- categories (id, user_id, name, type)
规则：只生成 SELECT，必须含 WHERE deleted_at IS NULL，不含 user_id 条件（服务端注入）
当前时间：{now}
只返回 SQL。
问题：{question}"""

def build_summarize_prompt(question: str, result: str) -> str:
    return f"""用户问："{question}"
查询结果：{result}
用简洁中文回答。结果为空则说"没有找到相关记录"。"""
```

- [ ] **Step 2：编写路由**

```python
import re
from fastapi import APIRouter, HTTPException, Request
from supabase import create_client
from jose import jwt
from schemas.text import TextRequest, TextResponse, TextBillData, TextNlData, TextErrorData
from schemas.ocr import Transaction
from services.glm import call_glm, extract_json, extract_sql
from config import settings

router = APIRouter()

def get_user_id(request: Request) -> str | None:
    """从 Authorization header 解码 user_id（不验证签名，只读取 payload）"""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.split(" ")[1]
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload.get("sub")
    except Exception:
        return None

@router.post("/record-text", response_model=TextResponse)
async def record_text(body: TextRequest, request: Request):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Missing text")

    # 1. 意图分类
    intent_raw = await call_glm(build_intent_prompt(body.text))
    intent_parsed = extract_json(intent_raw)
    intent = "query" if intent_parsed and intent_parsed.get("intent") == "query" else "record"

    if intent == "record":
        # 2a. 记账
        glm_raw = await call_glm(build_record_prompt(body.text))
        parsed = extract_json(glm_raw)
        if parsed and isinstance(parsed.get("amount"), (int, float)) and parsed["amount"] > 0:
            return TextResponse(data=TextBillData(
                transaction=Transaction(
                    amount=float(parsed["amount"]),
                    category=str(parsed.get("category", "其他支出")),
                    note=str(parsed.get("note", "")),
                    type="income" if parsed.get("type") == "income" else "expense",
                    occurred_at=str(parsed.get("occurred_at", "")),
                )
            ))
        return TextResponse(data=TextErrorData(message="没有识别到记账信息，请再描述一下。"))

    # 2b. 查询
    user_id = get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    sql_raw = await call_glm(build_query_prompt(body.text))
    sql = extract_sql(sql_raw)
    # 注入 user_id
    sql = re.sub(r"WHERE\s+", f"WHERE transactions.user_id = '{user_id}' AND ", sql, flags=re.IGNORECASE)

    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
    try:
        result = supabase.rpc("exec_readonly_sql", {"sql_text": sql}).execute()
        query_result = result.data
    except Exception:
        return TextResponse(data=TextErrorData(message="查询出错，请换个方式描述。"))

    summary_raw = await call_glm(build_summarize_prompt(body.text, str(query_result)))
    return TextResponse(data=TextNlData(message=summary_raw))
```

- [ ] **Step 3：本地测试记账意图**

```bash
curl -X POST http://localhost:8000/record-text \
  -H "Content-Type: application/json" \
  -d '{"text": "午饭35"}'
```

预期：`{"data": {"type": "bill", "transaction": {...}}}`

- [ ] **Step 4：提交**

```bash
git add apps/backend/routers/text.py
git commit -m "feat(backend): /record-text 接口（记账 + 自然语言查询）"
```

---

## Task 11：联调验证

- [ ] **Step 1：启动后端**

```bash
cd apps/backend
uv run uvicorn main:app --reload --port 8000
```

- [ ] **Step 2：测试三个接口连通性**

```bash
# ASR（用短 base64 字符串测通路）
curl -X POST http://localhost:8000/record-asr \
  -H "Content-Type: application/json" \
  -d '{"audioBase64": "dGVzdA=="}'

# OCR
curl -X POST http://localhost:8000/record-ocr \
  -H "Content-Type: application/json" \
  -d '{"imageBase64": "dGVzdA=="}'

# Text 记账意图
curl -X POST http://localhost:8000/record-text \
  -H "Content-Type: application/json" \
  -d '{"text": "午饭35"}'
```

- [ ] **Step 3：配置移动端连接**

确认 `apps/mobile/.env` 里：

```
EXPO_PUBLIC_API_URL=http://<本机局域网IP>:8000
```

本机局域网 IP 查看方式：`ipconfig getifaddr en0`（macOS）

- [ ] **Step 4：最终提交**

```bash
git add .
git commit -m "feat(backend): FastAPI 后端实现完成，替代 Supabase Edge Functions"
```

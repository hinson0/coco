# 移除规则引擎实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 去掉规则引擎和 OCR 正则提取，所有"理解"统一交给 Silicon LLM；ASR 合并进 `/chat` 端点。

**Architecture:** 三个入口统一为两个端点：`/chat`（文字+语音）和 `/record-ocr`（拍照）。`/chat` 接收 `text` 或 `audioBase64`，语音先 ASR 转文字再走 `classify_intent`。OCR 端点拿到 raw_text 后直接交 Silicon 提取明细。删除规则引擎、GLM 服务、`/record-asr`、`/record-text` 路由。

**Tech Stack:** Python 3.13, FastAPI, Pydantic v2, pytest + pytest-asyncio, React Native (Expo), TypeScript

---

### Task 1: silicon.py — 新增 `extract_bill_from_receipt()`

**Files:**
- Modify: `apps/backend/services/silicon.py:72-89`
- Test: `apps/backend/tests/test_silicon.py`

- [ ] **Step 1: 写失败测试**

在 `apps/backend/tests/test_silicon.py` 末尾添加：

```python
from unittest.mock import AsyncMock, patch


# ── extract_bill_from_receipt ────────────────────────
@pytest.mark.asyncio
@patch("services.silicon._call_silicon", new_callable=AsyncMock)
async def test_extract_bill_from_receipt_success(mock_call):
    mock_call.return_value = '{"amount": 99.5, "category": "餐饮", "note": "拿铁 28.00\\n美式 22.00\\n蛋糕 49.50", "type": "expense", "occurred_at": "2026-04-04T10:00:00"}'
    from services.silicon import extract_bill_from_receipt

    result = await extract_bill_from_receipt("拿铁 28.00\n美式 22.00\n蛋糕 49.50\n合计 99.50")
    assert result is not None
    assert result["amount"] == 99.5
    assert result["category"] == "餐饮"
    assert "拿铁" in result["note"]
    assert "\n" in result["note"]


@pytest.mark.asyncio
@patch("services.silicon._call_silicon", new_callable=AsyncMock)
async def test_extract_bill_from_receipt_no_amount(mock_call):
    mock_call.return_value = '{"amount": 0, "category": "其他支出", "note": "", "type": "expense", "occurred_at": ""}'
    from services.silicon import extract_bill_from_receipt

    result = await extract_bill_from_receipt("一堆乱码文字")
    assert result is None
```

文件顶部需要添加 `import pytest`（如尚未存在）。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/backend && uv run pytest tests/test_silicon.py::test_extract_bill_from_receipt_success tests/test_silicon.py::test_extract_bill_from_receipt_no_amount -v`

Expected: FAIL with `ImportError: cannot import name 'extract_bill_from_receipt'`

- [ ] **Step 3: 实现 `extract_bill_from_receipt`**

在 `apps/backend/services/silicon.py` 的 `extract_bill()` 函数（第 89 行）之后添加：

```python
async def extract_bill_from_receipt(raw_text: str) -> dict | None:
    """从小票 OCR 文本中提取记账信息（含逐行消费明细）"""
    now = datetime.now(timezone.utc).isoformat()
    system = """从小票 OCR 文本中提取记账信息，只返回 JSON。
格式：{"amount": number, "category": string, "note": string, "type": "expense"|"income", "occurred_at": string}

规则：
- amount：小票上的总金额（实付金额/合计金额）
- category：分类选项为 餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
- note：逐行列出消费明细，每行格式为「商品名 金额」，用换行符分隔。例如："拿铁 28.00\\n美式 22.00\\n蛋糕 49.50"
- type：通常为 "expense"
- occurred_at：小票上的日期，使用 ISO 8601 格式。若无日期则留空字符串

只返回 JSON，不要其他文字。"""
    user = f"当前时间：{now}\n小票 OCR 文本：\n{raw_text}"
    raw = await _call_silicon(system, user)
    parsed = extract_json(raw)
    if (
        parsed
        and isinstance(parsed.get("amount"), (int, float))
        and parsed["amount"] > 0
    ):
        return parsed
    return None
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/backend && uv run pytest tests/test_silicon.py -v`

Expected: ALL PASS（包括原有测试和新增的两个）

- [ ] **Step 5: 提交**

```bash
cd apps/backend && git add services/silicon.py tests/test_silicon.py && git commit -m "feat(backend): 新增 extract_bill_from_receipt OCR 专用提取函数"
```

---

### Task 2: schemas/chat.py — 扩展请求/响应模型

**Files:**
- Modify: `apps/backend/schemas/chat.py`

- [ ] **Step 1: 重写 `schemas/chat.py`**

将 `apps/backend/schemas/chat.py` 完整替换为：

```python
from pydantic import BaseModel, model_validator

from schemas.ocr import Transaction


class ChatRequest(BaseModel):
    text: str | None = None
    audioBase64: str | None = None

    @model_validator(mode="after")
    def check_at_least_one(self):
        if not self.text and not self.audioBase64:
            raise ValueError("text 或 audioBase64 至少提供一个")
        return self


class ChatTextData(BaseModel):
    type: str = "text"
    content: str
    asrText: str | None = None


class ChatBillData(BaseModel):
    type: str = "bill"
    transaction: Transaction
    asrText: str | None = None


class ChatNlData(BaseModel):
    type: str = "nl_result"
    content: str
    asrText: str | None = None


class ChatResponse(BaseModel):
    data: ChatBillData | ChatTextData | ChatNlData
```

变更点：
- `ChatRequest.text` 改为可选（`str | None`）
- `ChatRequest` 新增 `audioBase64: str | None`
- `model_validator` 确保至少提供一个
- 三个 Data 类都加 `asrText: str | None = None`
- 新增 `ChatNlData`（type="nl_result"），用于查询结果
- `ChatResponse.data` 联合类型加入 `ChatNlData`

- [ ] **Step 2: 运行已有测试确认不破坏**

Run: `cd apps/backend && uv run pytest tests/test_chat_router.py -v`

Expected: ALL PASS（已有测试仍然传 `{"text": "..."}` 所以不受影响）

- [ ] **Step 3: 提交**

```bash
cd apps/backend && git add schemas/chat.py && git commit -m "feat(backend): 扩展 ChatRequest 支持 audioBase64，新增 ChatNlData"
```

---

### Task 3: routers/chat.py — 支持语音输入

**Files:**
- Modify: `apps/backend/routers/chat.py`
- Test: `apps/backend/tests/test_chat_router.py`

- [ ] **Step 1: 写失败测试**

在 `apps/backend/tests/test_chat_router.py` 末尾添加：

```python
# ── 语音输入（audioBase64） ──────────────────────────
@patch("routers.chat.classify_intent", new_callable=AsyncMock, return_value="record")
@patch(
    "routers.chat.extract_bill",
    new_callable=AsyncMock,
    return_value={
        "amount": 30,
        "category": "餐饮",
        "note": "咖啡",
        "type": "expense",
        "occurred_at": "2026-04-04T10:00:00+08:00",
    },
)
@patch(
    "routers.chat.recognize_speech",
    return_value="买了杯咖啡30块",
)
def test_chat_audio_record(mock_asr, mock_bill, mock_intent):
    resp = client.post("/chat", json={"audioBase64": "fakebase64"}, headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "bill"
    assert data["asrText"] == "买了杯咖啡30块"
    assert data["transaction"]["amount"] == 30


@patch(
    "routers.chat.recognize_speech",
    return_value="",
)
def test_chat_audio_empty_asr(mock_asr):
    resp = client.post("/chat", json={"audioBase64": "fakebase64"}, headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "text"
    assert "没听清" in data["content"]


def test_chat_no_text_no_audio():
    resp = client.post("/chat", json={}, headers=HEADERS)
    assert resp.status_code == 422  # Pydantic validation error


# ── query 意图返回 nl_result ─────────────────────────
@patch("routers.chat.classify_intent", new_callable=AsyncMock, return_value="query")
@patch("routers.chat.generate_sql", new_callable=AsyncMock, return_value="SELECT SUM(amount) FROM transactions WHERE deleted_at IS NULL")
@patch("routers.chat.summarize_result", new_callable=AsyncMock, return_value="本月共消费 2350.00 元")
def test_chat_query_returns_nl_result(mock_summary, mock_sql, mock_intent):
    with patch("routers.chat.get_user_id", return_value="user-123"), \
         patch("routers.chat.create_client") as mock_supabase:
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value = MagicMock(data=[{"sum": 2350}])
        mock_supabase.return_value.rpc.return_value = mock_rpc

        resp = client.post("/chat", json={"text": "这个月花了多少"}, headers=HEADERS)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["type"] == "nl_result"
        assert "2350" in data["content"]
```

文件顶部确保已有 `from unittest.mock import AsyncMock, MagicMock, patch`。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/backend && uv run pytest tests/test_chat_router.py::test_chat_audio_record tests/test_chat_router.py::test_chat_audio_empty_asr tests/test_chat_router.py::test_chat_no_text_no_audio tests/test_chat_router.py::test_chat_query_returns_nl_result -v`

Expected: FAIL（`recognize_speech` 未被 import、`ChatNlData` 未被使用等）

- [ ] **Step 3: 重写 `routers/chat.py`**

将 `apps/backend/routers/chat.py` 完整替换为：

```python
import re

import structlog
from config import settings
from fastapi import APIRouter, Request
from jose import jwt
from schemas.chat import (
    ChatBillData,
    ChatNlData,
    ChatRequest,
    ChatResponse,
    ChatTextData,
)
from schemas.ocr import Transaction
from services.silicon import (
    chat_reply,
    classify_intent,
    extract_bill,
    generate_sql,
    summarize_result,
)
from services.tencent import recognize_speech
from supabase import create_client

log = structlog.get_logger()

router = APIRouter(prefix="/chat", tags=["chat"])


def get_user_id(request: Request) -> str | None:
    """从 Authorization header 解码 user_id"""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.split(" ")[1]
    try:
        payload = jwt.get_unverified_claims(token)
        return payload.get("sub")
    except Exception:
        return None


def is_safe_sql(sql: str) -> bool:
    stripped = sql.strip().upper()
    return stripped.startswith("SELECT") and not any(
        re.search(rf"\b{kw}\b", stripped)
        for kw in ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE"]
    )


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest, request: Request):
    try:
        asr_text: str | None = None

        # 语音输入：先做 ASR 转文字
        if body.audioBase64:
            asr_text = recognize_speech(body.audioBase64)
            if not asr_text:
                return ChatResponse(
                    data=ChatTextData(content="没听清，要不再说一次？")
                )
            text = asr_text
        else:
            text = body.text

        # 统一走 classify_intent
        intent = await classify_intent(text)
        log.info("chat.intent", intent=intent, has_audio=body.audioBase64 is not None)

        if intent == "record":
            bill = await extract_bill(text)
            if bill:
                transaction = Transaction(
                    amount=float(bill["amount"]),
                    category=str(bill.get("category", "其他支出")),
                    note=bill.get("note") or "",
                    type="income" if bill.get("type") == "income" else "expense",
                    occurred_at=bill.get("occurred_at", ""),
                )
                return ChatResponse(
                    data=ChatBillData(transaction=transaction, asrText=asr_text)
                )
            else:
                return ChatResponse(
                    data=ChatTextData(
                        content="没解析到账单信息，可以试试「手动记账」。",
                        asrText=asr_text,
                    )
                )
        elif intent == "query":
            user_id = get_user_id(request)
            if not user_id:
                return ChatResponse(
                    data=ChatTextData(
                        content="登录状态异常，请重新登录。", asrText=asr_text
                    )
                )
            sql = await generate_sql(text)
            if not is_safe_sql(sql):
                return ChatResponse(
                    data=ChatTextData(
                        content="查询失败，请换个说法。", asrText=asr_text
                    )
                )

            sql = re.sub(
                r"WHERE\s+",
                f"WHERE transactions.user_id = '{user_id}' AND ",
                sql,
                count=1,
                flags=re.IGNORECASE,
            )

            supabase = create_client(
                settings.supabase_url,
                settings.supabase_service_role_key,
            )

            try:
                result = supabase.rpc(
                    "exec_readonly_sql", {"sql_query": sql}
                ).execute()
                query_result = result.data
            except Exception:
                return ChatResponse(
                    data=ChatTextData(
                        content="查询出错，请换个方式描述。", asrText=asr_text
                    )
                )

            summary = await summarize_result(question=text, rows=query_result)
            return ChatResponse(
                data=ChatNlData(content=summary, asrText=asr_text)
            )
        else:
            reply = await chat_reply(text)
            return ChatResponse(
                data=ChatTextData(content=reply, asrText=asr_text)
            )
    except Exception:
        return ChatResponse(
            data=ChatTextData(content="处理失败，请稍后再试。")
        )
```

变更点：
- 导入 `recognize_speech`、`ChatNlData`、`structlog`
- 请求处理开头：判断 `audioBase64` → ASR 转文字
- 所有响应传入 `asrText=asr_text`
- query 意图返回 `ChatNlData` 而非 `ChatTextData`
- 移除 `print()` debug 语句，改用 `structlog`

- [ ] **Step 4: 运行全部测试确认通过**

Run: `cd apps/backend && uv run pytest tests/test_chat_router.py -v`

Expected: ALL PASS（原有 4 个 + 新增 4 个）

- [ ] **Step 5: 提交**

```bash
cd apps/backend && git add routers/chat.py tests/test_chat_router.py && git commit -m "feat(backend): /chat 支持语音输入，query 返回 nl_result 类型"
```

---

### Task 4: schemas/ocr.py — 简化响应类型

**Files:**
- Modify: `apps/backend/schemas/ocr.py`

- [ ] **Step 1: 重写 `schemas/ocr.py`**

将 `apps/backend/schemas/ocr.py` 完整替换为：

```python
from pydantic import BaseModel


class OcrRequest(BaseModel):
    imageBase64: str


class Transaction(BaseModel):
    amount: float
    category: str
    note: str
    occurred_at: str
    type: str  # expense | income


class OcrBillData(BaseModel):
    type: str = "bill"
    transaction: Transaction


class OcrErrorData(BaseModel):
    type: str = "error"
    message: str


class OcrResponse(BaseModel):
    data: OcrBillData | OcrErrorData
```

变更点：
- 删除 `OcrTextData` 类
- `OcrResponse.data` 联合类型只保留 `OcrBillData | OcrErrorData`
- 删除文件顶部的 tagged union 注释（已过时）

- [ ] **Step 2: 提交**

```bash
cd apps/backend && git add schemas/ocr.py && git commit -m "refactor(backend): 简化 OcrResponse 为 bill/error 两种类型"
```

---

### Task 5: routers/ocr.py — 去掉正则，接入 Silicon

**Files:**
- Modify: `apps/backend/routers/ocr.py`
- Create: `apps/backend/tests/test_ocr_router.py`

- [ ] **Step 1: 写失败测试**

创建 `apps/backend/tests/test_ocr_router.py`：

```python
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


@patch(
    "routers.ocr.extract_bill_from_receipt",
    new_callable=AsyncMock,
    return_value={
        "amount": 99.5,
        "category": "餐饮",
        "note": "拿铁 28.00\n美式 22.00\n蛋糕 49.50",
        "type": "expense",
        "occurred_at": "2026-04-04T10:00:00",
    },
)
@patch("routers.ocr.recognize_receipt", return_value="拿铁 28.00\n美式 22.00\n蛋糕 49.50\n合计 99.50")
def test_ocr_bill_success(mock_ocr, mock_silicon):
    resp = client.post("/record-ocr", json={"imageBase64": "fakebase64"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "bill"
    assert data["transaction"]["amount"] == 99.5
    assert "拿铁" in data["transaction"]["note"]


@patch("routers.ocr.recognize_receipt", return_value="")
def test_ocr_empty_text(mock_ocr):
    resp = client.post("/record-ocr", json={"imageBase64": "fakebase64"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "error"


@patch(
    "routers.ocr.extract_bill_from_receipt",
    new_callable=AsyncMock,
    return_value=None,
)
@patch("routers.ocr.recognize_receipt", return_value="一些无法识别的文字")
def test_ocr_silicon_fail(mock_ocr, mock_silicon):
    resp = client.post("/record-ocr", json={"imageBase64": "fakebase64"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "error"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/backend && uv run pytest tests/test_ocr_router.py -v`

Expected: FAIL（`extract_bill_from_receipt` 未被路由 import）

- [ ] **Step 3: 重写 `routers/ocr.py`**

将 `apps/backend/routers/ocr.py` 完整替换为：

```python
import structlog
from fastapi import APIRouter
from schemas.ocr import OcrBillData, OcrErrorData, OcrRequest, OcrResponse, Transaction
from services.silicon import extract_bill_from_receipt
from services.tencent import recognize_receipt

log = structlog.get_logger()

router = APIRouter(prefix="/record-ocr", tags=["ocr"])


@router.post("", response_model=OcrResponse)
async def record_ocr(body: OcrRequest):
    ocr_text = recognize_receipt(body.imageBase64)
    if not ocr_text.strip():
        log.warning("ocr.empty")
        return OcrResponse(
            data=OcrErrorData(message="无法识别小票内容，请确保图片清晰后重试。")
        )

    bill = await extract_bill_from_receipt(ocr_text)
    if bill:
        transaction = Transaction(
            amount=float(bill["amount"]),
            category=str(bill.get("category", "其他支出")),
            note=bill.get("note") or "",
            type="income" if bill.get("type") == "income" else "expense",
            occurred_at=bill.get("occurred_at", ""),
        )
        log.info("ocr.parsed", amount=transaction.amount, category=transaction.category)
        return OcrResponse(data=OcrBillData(transaction=transaction))

    log.info("ocr.silicon_fail", ocr_text_len=len(ocr_text.encode()))
    return OcrResponse(
        data=OcrErrorData(message="无法识别小票内容，请手动记账。")
    )
```

变更点：
- 删除 `extract_receipt_info()` 整个函数
- 删除 `re`、`datetime` 导入
- 删除 `OcrTextData` 导入
- OCR 结果直接交给 `extract_bill_from_receipt()`
- 响应只有 bill/error 两种

- [ ] **Step 4: 运行全部测试确认通过**

Run: `cd apps/backend && uv run pytest tests/test_ocr_router.py tests/test_silicon.py tests/test_chat_router.py -v`

Expected: ALL PASS

- [ ] **Step 5: 提交**

```bash
cd apps/backend && git add routers/ocr.py tests/test_ocr_router.py && git commit -m "feat(backend): OCR 路由接入 Silicon，去掉正则提取"
```

---

### Task 6: 删除后端旧代码 + 清理注册

**Files:**
- Delete: `apps/backend/services/glm.py`
- Delete: `apps/backend/routers/text.py`
- Delete: `apps/backend/routers/asr.py`
- Delete: `apps/backend/schemas/asr.py`
- Delete: `apps/backend/schemas/text.py`
- Modify: `apps/backend/routers/__init__.py`
- Modify: `apps/backend/config.py`
- Modify: `apps/backend/.env.example`

- [ ] **Step 1: 删除文件**

```bash
cd apps/backend && rm services/glm.py routers/text.py routers/asr.py schemas/asr.py schemas/text.py
```

- [ ] **Step 2: 更新 `routers/__init__.py`**

将 `apps/backend/routers/__init__.py` 完整替换为：

```python
from fastapi import APIRouter

from .chat import router as chat_router
from .ocr import router as ocr_router

all_routers = APIRouter()

all_routers.include_router(ocr_router)
all_routers.include_router(chat_router)
```

- [ ] **Step 3: 更新 `config.py`**

将 `apps/backend/config.py` 中删除 `glm_api_key` 行：

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    silicon_api_key: str
    tencent_secret_id: str
    tencent_secret_key: str
    supabase_url: str
    supabase_service_role_key: str

    # Logging
    app_env: str = "dev"
    log_level: str = "DEBUG"


# 保证全局唯一实例.也就是单例模式:singleton pattern
settings = Settings()  # pyright: ignore[reportCallIssue]
```

- [ ] **Step 4: 更新 `.env.example`**

将 `apps/backend/.env.example` 替换为：

```
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# 腾讯云
TENCENT_SECRET_ID=
TENCENT_SECRET_KEY=

# SiliconFlow
SILICON_API_KEY=

# Logging
APP_ENV=dev          # dev | prod
LOG_LEVEL=DEBUG      # DEBUG | INFO | WARNING
```

删除了 `GLM_API_KEY` 条目。

- [ ] **Step 5: 更新 `.env`**

从 `apps/backend/.env` 中删除 `GLM_API_KEY=...` 行（保留其他变量不变）。

- [ ] **Step 6: 运行全部测试确认不破坏**

Run: `cd apps/backend && uv run pytest tests/ -v`

Expected: ALL PASS

- [ ] **Step 7: 提交**

```bash
cd apps/backend && git add -A && git commit -m "refactor(backend): 删除 GLM、ASR 路由、text 路由，清理配置"
```

---

### Task 7: 前端 useChat.ts 改造

**Files:**
- Modify: `apps/mobile/hooks/useChat.ts`

- [ ] **Step 1: 更新类型定义（第 1-32 行）**

将文件头部的类型定义和 import 替换为：

```typescript
1; // apps/mobile/hooks/useChat.ts
import { useAddChatMessage } from "@/hooks/useLocalChatMessages";
import { useCreateTransaction } from "@/hooks/useLocalTransactions";
import { useOfflineContext } from "@/lib/offline-context";
import type { Category } from "@coco/shared";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useState } from "react";
import { apiFetch } from "../lib/api";

type ChatBillData = {
  type: "bill";
  asrText?: string;
  transaction: {
    amount: number;
    category: string;
    note: string;
    occurred_at: string;
    type: "expense" | "income";
  };
};

type ChatTextData = {
  type: "text";
  asrText?: string;
  content: string;
};

type ChatNlData = {
  type: "nl_result";
  asrText?: string;
  content: string;
};

type ChatResponse = {
  data: ChatBillData | ChatTextData | ChatNlData;
};
```

变更点：
- 删除 `import { parse } from "@coco/shared"`
- 三个 Data 类型加 `asrText?: string`
- 新增 `ChatNlData` 类型
- `ChatResponse.data` 联合类型加入 `ChatNlData`

- [ ] **Step 2: 重写 `processText`（第 43-179 行）**

将 `processText` 函数替换为：

```typescript
  // ─── 核心处理逻辑：直接调 /chat ───
  // sendText 共享此逻辑
  const processText = useCallback(
    async (text: string) => {
      console.log("[processText] 输入:", text);

      const thinkingMsgId = await addMessage({
        role: "assistant",
        content_type: "text",
        content: "思考中...",
      });

      try {
        const resp = await apiFetch<ChatResponse>("/chat", {
          method: "POST",
          body: JSON.stringify({ text }),
        });

        console.log("[processText] /chat 返回:", JSON.stringify(resp.data));

        if (resp.data.type === "bill") {
          const tx = resp.data.transaction;
          const categoriesData = qc.getQueryData<readonly Category[]>([
            "categories",
          ]);
          const otherName = tx.type === "income" ? "其他收入" : "其他支出";
          const category =
            (tx.category
              ? categoriesData?.find(
                  (c) => c.name === tx.category && c.type === tx.type,
                )
              : null) ?? categoriesData?.find((c) => c.name === otherName);

          const occurredAt = tx.occurred_at || new Date().toISOString();
          const txId = await createTransaction({
            amount: tx.amount,
            category_id: category?.id ?? "",
            type: tx.type,
            note: tx.note,
            occurred_at: occurredAt,
            source: "llm",
          });

          await db!.runAsync(
            "UPDATE chat_messages SET content_type = ?, content = ?, transaction_id = ? WHERE id = ?",
            "bill_card",
            JSON.stringify({
              id: txId,
              amount: tx.amount,
              type: tx.type,
              note: tx.note,
              category_id: category?.id ?? "",
              occurred_at: occurredAt,
            }),
            txId,
            thinkingMsgId,
          );
          qc.invalidateQueries({ queryKey: ["chat-messages"] });
        } else {
          // text 或 nl_result，都有 content 字段
          await db!.runAsync(
            "UPDATE chat_messages SET content = ? WHERE id = ?",
            resp.data.content,
            thinkingMsgId,
          );
          qc.invalidateQueries({ queryKey: ["chat-messages"] });
        }
      } catch (err) {
        console.error("[processText] /chat 异常:", err);
        await db!.runAsync(
          "UPDATE chat_messages SET content = ? WHERE id = ?",
          "处理失败，请稍后再试。",
          thinkingMsgId,
        );
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
      }
    },
    [qc, addMessage, createTransaction, db],
  );
```

变更点：
- 删除规则引擎 `parse()` 调用和整个 `if (ruleResult)` 分支
- 直接进入 "思考中..." → 调 `/chat` 流程
- `else` 分支注释说明 text 和 nl_result 都走这里

- [ ] **Step 3: 简化 `sendOcr`（第 200-322 行）**

将 `sendOcr` 函数替换为：

```typescript
  const sendOcr = useCallback(
    async (
      imageBase64: string,
      onFail?: (imageMessageId: string) => void,
    ) => {
      if (!db) return;
      console.log("[sendOcr] 拍照记账");
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        console.log("[sendOcr] ❌ 离线");
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "拍照记账需要联网才能使用，请连接网络后重试。",
        });
        return;
      }
      // 保存图片到本地文件系统
      let imageContent = "[拍照]";
      try {
        const dir = `${FileSystem.documentDirectory}ocr-images/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const filePath = `${dir}${Date.now()}-${Crypto.randomUUID()}.jpg`;
        await FileSystem.writeAsStringAsync(filePath, imageBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        imageContent = filePath;
      } catch (err) {
        console.error("[sendOcr] 图片保存失败:", err);
      }
      const imageMessageId = await addMessage({
        role: "user",
        content_type: "image",
        content: imageContent,
      });
      console.log("[sendOcr] → 调用 /record-ocr");
      setLoading(true);
      try {
        const resp = await apiFetch<any>("/record-ocr", {
          method: "POST",
          body: JSON.stringify({ imageBase64 }),
        });
        console.log("[sendOcr] OCR 返回:", JSON.stringify(resp.data));
        if (resp.data?.type === "bill") {
          const tx = resp.data.transaction;
          const categoriesData = qc.getQueryData<readonly Category[]>([
            "categories",
          ]);
          const otherName = tx.type === "income" ? "其他收入" : "其他支出";
          const category =
            (tx.category
              ? categoriesData?.find(
                  (c) => c.name === tx.category && c.type === tx.type,
                )
              : null) ?? categoriesData?.find((c) => c.name === otherName);
          const txId = await createTransaction({
            amount: tx.amount,
            category_id: category?.id ?? "",
            type: tx.type,
            note: tx.note ?? "",
            occurred_at: tx.occurred_at ?? new Date().toISOString(),
            source: "ocr",
          });
          console.log(
            "[sendOcr] ✅ OCR 记账 → 分类:",
            category?.name,
            "| 金额:",
            tx.amount,
          );
          await addMessage({
            role: "assistant",
            content_type: "bill_card",
            content: JSON.stringify({
              id: txId,
              amount: tx.amount,
              type: tx.type,
              note: tx.note ?? "",
              category_id: category?.id,
              occurred_at: tx.occurred_at ?? new Date().toISOString(),
            }),
            transaction_id: txId,
          });
          qc.invalidateQueries({ queryKey: ["transactions"] });
        } else {
          // error
          console.log("[sendOcr] ⚠️ OCR 失败:", resp.data?.message);
          await addMessage({
            role: "assistant",
            content_type: "text",
            content: resp.data?.message ?? "小票识别失败，请手动记账。",
          });
          onFail?.(imageMessageId);
        }
      } catch (err) {
        console.error("[sendOcr] ❌ OCR 异常:", err);
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "网络错误，OCR 识别失败。",
        });
        onFail?.(imageMessageId);
      } finally {
        setLoading(false);
      }
    },
    [db, qc, addMessage, createTransaction],
  );
```

变更点：
- 删除 `onOcrText` 回调参数
- 删除 `type === "ocr_text"` 分支
- 只保留 bill / error 两种响应处理

- [ ] **Step 4: 重写 `sendAsr`（第 324-402 行）**

将 `sendAsr` 函数替换为：

```typescript
  const sendAsr = useCallback(
    async (audioBase64: string, durationSeconds: number) => {
      if (!db) return;

      // 1. 保存音频文件到本地
      let audioUri: string | null = null;
      try {
        const dir = `${FileSystem.documentDirectory}voice-messages/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        audioUri = `${dir}${Date.now()}-${Crypto.randomUUID()}.m4a`;
        await FileSystem.writeAsStringAsync(audioUri, audioBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (err) {
        console.error("[sendAsr] 音频保存失败:", err);
      }

      // 2. 乐观渲染：立即显示语音气泡
      const msgId = await addMessage({
        role: "user",
        content_type: "audio",
        content: "[语音]",
        audio_uri: audioUri,
        duration_seconds: durationSeconds,
      });

      // 3. 检查网络
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "未联网，无法使用语音服务。",
        });
        return;
      }

      // 4. 调用 /chat（后端做 ASR + classify_intent）
      console.log("[sendAsr] → 调用 /chat (语音)");
      const thinkingMsgId = await addMessage({
        role: "assistant",
        content_type: "text",
        content: "思考中...",
      });

      try {
        const resp = await apiFetch<ChatResponse>("/chat", {
          method: "POST",
          body: JSON.stringify({ audioBase64 }),
        });

        console.log("[sendAsr] /chat 返回:", JSON.stringify(resp.data));

        // 更新语音气泡的转写文字
        const asrText = resp.data.asrText;
        if (asrText) {
          await db.runAsync(
            "UPDATE chat_messages SET content = ? WHERE id = ?",
            asrText,
            msgId,
          );
          qc.invalidateQueries({ queryKey: ["chat-messages"] });
        }

        if (resp.data.type === "bill") {
          const tx = resp.data.transaction;
          const categoriesData = qc.getQueryData<readonly Category[]>([
            "categories",
          ]);
          const otherName = tx.type === "income" ? "其他收入" : "其他支出";
          const category =
            (tx.category
              ? categoriesData?.find(
                  (c) => c.name === tx.category && c.type === tx.type,
                )
              : null) ?? categoriesData?.find((c) => c.name === otherName);

          const occurredAt = tx.occurred_at || new Date().toISOString();
          const txId = await createTransaction({
            amount: tx.amount,
            category_id: category?.id ?? "",
            type: tx.type,
            note: tx.note,
            occurred_at: occurredAt,
            source: "asr",
          });

          await db.runAsync(
            "UPDATE chat_messages SET content_type = ?, content = ?, transaction_id = ? WHERE id = ?",
            "bill_card",
            JSON.stringify({
              id: txId,
              amount: tx.amount,
              type: tx.type,
              note: tx.note,
              category_id: category?.id ?? "",
              occurred_at: occurredAt,
            }),
            txId,
            thinkingMsgId,
          );
          qc.invalidateQueries({ queryKey: ["chat-messages"] });
        } else {
          // text 或 nl_result
          await db.runAsync(
            "UPDATE chat_messages SET content = ? WHERE id = ?",
            resp.data.content,
            thinkingMsgId,
          );
          qc.invalidateQueries({ queryKey: ["chat-messages"] });
        }
      } catch (err) {
        console.error("[sendAsr] ❌ 异常:", err);
        await db.runAsync(
          "UPDATE chat_messages SET content = ? WHERE id = ?",
          "没听清，要不再说一次？",
          thinkingMsgId,
        );
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
      }
    },
    [db, qc, addMessage, createTransaction],
  );
```

变更点：
- 不再调 `/record-asr` + `processText()`
- 改为 `POST /chat { audioBase64 }`，后端一步到位
- 从响应的 `asrText` 更新语音气泡转写文字
- 添加 "思考中..." 消息
- source 改为 `"asr"`（而非 `"llm"`）

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/hooks/useChat.ts && git commit -m "refactor(mobile): 去掉规则引擎，sendAsr 合并进 /chat，简化 sendOcr"
```

---

### Task 8: 前端 index.tsx — 更新 sendOcr 调用

**Files:**
- Modify: `apps/mobile/app/index.tsx:164,366`

- [ ] **Step 1: 更新 `sendOcr` 调用**

`sendOcr` 签名从 `(base64, onFail, onOcrText)` 变为 `(base64, onFail)`。需要修改两处调用：

**第 164 行** `handleResendOcr` 函数内：

```typescript
// 改前
sendOcr(base64, onOcrFail, (merchant) => {
  router.push({
    pathname: "/manual-entry",
    params: { ocrNote: merchant ?? "" },
  });
});

// 改后
sendOcr(base64, onOcrFail);
```

**第 366 行** `onCamera` 回调内：

```typescript
// 改前
if (base64) sendOcr(base64, onOcrFail, (merchant) => {
  router.push({
    pathname: "/manual-entry",
    params: { ocrNote: merchant ?? "" },
  });
});

// 改后
if (base64) sendOcr(base64, onOcrFail);
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/app/index.tsx && git commit -m "refactor(mobile): 更新 sendOcr 调用，移除 onOcrText 回调"
```

---

### Task 9: 删除规则引擎 + 清理共享包导出

**Files:**
- Delete: `packages/shared/src/rule-engine/` (整个目录)
- Modify: `packages/shared/src/index.ts:10`

- [ ] **Step 1: 删除规则引擎目录**

```bash
rm -rf packages/shared/src/rule-engine
```

- [ ] **Step 2: 更新 `packages/shared/src/index.ts`**

删除最后一行导出，将文件改为：

```typescript
export * from "./constants/categories";
export * from "./constants/transaction";
export * from "./types/account";
export * from "./types/api";
export * from "./types/budget";
export * from "./types/category";
export * from "./types/chat";
export * from "./types/profile";
export * from "./types/transaction";
```

- [ ] **Step 3: 确认 TypeScript 编译通过**

Run: `pnpm --filter @coco/shared build` 或 `cd packages/shared && npx tsc --noEmit`

Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add -A && git commit -m "refactor(shared): 删除规则引擎 parse() 及全部关键词库"
```

---

### Task 10: 全量验证

- [ ] **Step 1: 后端全部测试**

Run: `cd apps/backend && uv run pytest tests/ -v`

Expected: ALL PASS

- [ ] **Step 2: 前端 TypeScript 检查**

Run: `pnpm --filter mobile tsc --noEmit`

Expected: 无类型错误

- [ ] **Step 3: 后端启动测试**

Run: `cd apps/backend && uv run uvicorn main:app --host 0.0.0.0 --port 8000`

确认启动无报错，`/health` 返回 `{"status": "ok"}`。

- [ ] **Step 4: 最终提交（如有遗漏）**

确认 `git status` 干净，所有改动已提交。

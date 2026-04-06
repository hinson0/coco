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
        # 语音输入：先做 ASR 转文字
        if body.audioBase64:
            asr_text = recognize_speech(body.audioBase64)
            if not asr_text:
                return ChatResponse(data=ChatTextData(content="没听清，要不再说一次？"))
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
                result = supabase.rpc("exec_readonly_sql", {"sql_query": sql}).execute()
                query_result = result.data
            except Exception:
                return ChatResponse(
                    data=ChatTextData(
                        content="查询出错，请换个方式描述。", asrText=asr_text
                    )
                )

            summary = await summarize_result(question=text, rows=query_result)
            return ChatResponse(data=ChatNlData(content=summary, asrText=asr_text))
        else:
            reply = await chat_reply(text)
            return ChatResponse(data=ChatTextData(content=reply, asrText=asr_text))
    except Exception:
        return ChatResponse(data=ChatTextData(content="处理失败，请稍后再试。"))

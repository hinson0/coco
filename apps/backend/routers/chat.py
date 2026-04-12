import re
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from infra.database import get_db
from infra.security import get_current_user
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

log = structlog.get_logger()

router = APIRouter(prefix="/chat", tags=["chat"])


def is_safe_sql(sql: str) -> bool:
    stripped = sql.strip().upper()
    return stripped.startswith("SELECT") and not any(
        re.search(rf"\b{kw}\b", stripped)
        for kw in ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE"]
    )


@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    current_user_id: Annotated[str, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        asr_text: str | None = None

        if body.audioBase64:
            asr_text = recognize_speech(audio_base64=body.audioBase64)
            if not asr_text:
                return ChatResponse(
                    data=ChatTextData(content="没听清，要不再说一次？")
                )
            text_input = asr_text
        else:
            assert body.text is not None, "文本输入不能为空"
            text_input = body.text

        intent = await classify_intent(text_input)
        log.info(
            "chat.intent", intent=intent, has_audio=body.audioBase64 is not None
        )

        if intent == "record":
            bill = await extract_bill(text_input)
            if bill:
                transaction = Transaction(
                    amount=float(bill["amount"]),
                    category=str(bill.get("category", "其他支出")),
                    note=bill.get("note") or "",
                    type="income"
                    if bill.get("type") == "income"
                    else "expense",
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
            sql_query = await generate_sql(text_input)
            if not is_safe_sql(sql_query):
                return ChatResponse(
                    data=ChatTextData(
                        content="查询失败，请换个说法。", asrText=asr_text
                    )
                )

            sql_query = re.sub(
                r"WHERE\s+",
                f"WHERE transactions.user_id = '{current_user_id}' AND ",
                sql_query,
                count=1,
                flags=re.IGNORECASE,
            )

            try:
                result = await db.execute(sql_text(sql_query))
                query_result = [dict(row) for row in result.mappings().all()]
            except Exception:
                return ChatResponse(
                    data=ChatTextData(
                        content="查询出错，请换个方式描述。", asrText=asr_text
                    )
                )

            summary = await summarize_result(
                question=text_input, rows=query_result
            )
            return ChatResponse(
                data=ChatNlData(content=summary, asrText=asr_text)
            )
        else:
            reply = await chat_reply(text_input)
            return ChatResponse(
                data=ChatTextData(content=reply, asrText=asr_text)
            )
    except Exception:
        return ChatResponse(data=ChatTextData(content="处理失败，请稍后再试。"))

import asyncio
import re
from collections.abc import AsyncGenerator
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
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
from schemas.chat_stream import (
    SSE_DONE,
    StreamAsrEvent,
    StreamBillEvent,
    StreamChunkEvent,
    StreamErrorEvent,
    StreamTextEvent,
    sse_line,
)
from schemas.ocr import Transaction
from services.silicon import (
    chat_reply,
    classify_intent,
    extract_bill,
    generate_sql,
    narrate_chat_stream,
    narrate_record_stream,
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


# ── SSE 流式端点 ─────────────────────────────────────


async def _stream_record_events(
    text_input: str, asr_text: str | None
) -> AsyncGenerator[str]:
    """话术流式生成 + 并发解析账单，边吐 chunk 边等解析结果。"""
    extract_task = asyncio.create_task(extract_bill(text_input))
    try:
        async for chunk in narrate_record_stream(text_input):
            yield sse_line(StreamChunkEvent(text=chunk))
    except Exception:
        log.exception("chat.stream.narrate_record_failed")

    extract_failed = False
    try:
        bill = await extract_task
    except Exception:
        log.exception("chat.stream.extract_bill_failed")
        bill = None
        extract_failed = True

    if bill:
        transaction = Transaction(
            amount=float(bill["amount"]),
            category=str(bill.get("category", "其他支出")),
            note=bill.get("note") or "",
            type="income" if bill.get("type") == "income" else "expense",
            occurred_at=bill.get("occurred_at", ""),
        )
        yield sse_line(
            StreamBillEvent(transaction=transaction, asr_text=asr_text)
        )
    elif extract_failed:
        # 上游 LLM 异常（超时/限流/解析服务挂）—— 与"解析成功但内容为空"
        # 区分开，避免误导用户以为是自己输入的问题。
        yield sse_line(StreamErrorEvent(message="识别服务暂时繁忙,请稍后再试~"))
    else:
        yield sse_line(
            StreamTextEvent(
                content="没解析到账单信息，可以试试「手动记账」。",
                asr_text=asr_text,
            )
        )


async def _stream_chat_events(
    text_input: str, _asr_text: str | None
) -> AsyncGenerator[str]:
    # 签名与其它 _stream_*_events 保持一致（方便路由层统一分发），
    # 但闲聊分支不回显 ASR 文本——语音转写结果已在流首 StreamAsrEvent 下发。
    try:
        async for chunk in narrate_chat_stream(text_input):
            yield sse_line(StreamChunkEvent(text=chunk))
    except Exception:
        log.exception("chat.stream.narrate_chat_failed")
    # 闲聊不发终态 text 事件，前端在流结束时把累积 chunk 落成 text 消息。


async def _stream_query_events(
    text_input: str,
    asr_text: str | None,
    current_user_id: str,
    db: AsyncSession,
) -> AsyncGenerator[str]:
    sql_query = await generate_sql(text_input)
    if not is_safe_sql(sql_query):
        yield sse_line(
            StreamTextEvent(content="查询失败，请换个说法。", asr_text=asr_text)
        )
        return

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
        yield sse_line(
            StreamTextEvent(
                content="查询出错，请换个方式描述。", asr_text=asr_text
            )
        )
        return

    summary = await summarize_result(question=text_input, rows=query_result)
    yield sse_line(StreamTextEvent(content=summary, asr_text=asr_text))


@router.post("/stream")
async def chat_stream(
    body: ChatRequest,
    current_user_id: Annotated[str, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    async def event_generator() -> AsyncGenerator[str]:
        try:
            asr_text: str | None = None
            if body.audioBase64:
                asr_text = await asyncio.to_thread(
                    recognize_speech, audio_base64=body.audioBase64
                )
                if not asr_text:
                    yield sse_line(
                        StreamTextEvent(content="没听清，要不再说一次？")
                    )
                    yield SSE_DONE
                    return
                yield sse_line(StreamAsrEvent(text=asr_text))
                text_input = asr_text
            else:
                assert body.text is not None, "文本输入不能为空"
                text_input = body.text

            intent = await classify_intent(text_input)
            log.info(
                "chat.stream.intent",
                intent=intent,
                has_audio=body.audioBase64 is not None,
            )

            if intent == "record":
                async for line in _stream_record_events(text_input, asr_text):
                    yield line
            elif intent == "query":
                async for line in _stream_query_events(
                    text_input, asr_text, current_user_id, db
                ):
                    yield line
            else:
                async for line in _stream_chat_events(text_input, asr_text):
                    yield line
        except Exception:
            log.exception("chat.stream.unhandled")
            yield sse_line(StreamErrorEvent(message="处理失败，请稍后再试。"))
        finally:
            yield SSE_DONE

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

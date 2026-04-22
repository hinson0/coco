import asyncio
from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import structlog
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from schemas.chat_stream import (
    SSE_DONE,
    StreamBillEvent,
    StreamChunkEvent,
    StreamErrorEvent,
    StreamTextEvent,
    sse_line,
)
from schemas.ocr import (
    OcrBillData,
    OcrErrorData,
    OcrRequest,
    OcrResponse,
    Transaction,
)
from services.silicon import extract_bill_from_receipt, narrate_ocr_stream
from services.tencent import recognize_receipt

log = structlog.get_logger()

router = APIRouter(prefix="/record-ocr", tags=["ocr"])


@router.post("", response_model=OcrResponse)
async def record_ocr(body: OcrRequest):
    ocr_text = recognize_receipt(body.imageBase64)
    if not ocr_text.strip():
        log.warning("ocr.empty")
        return OcrResponse(
            data=OcrErrorData(
                message="无法识别小票内容，请确保图片清晰后重试。"
            )
        )

    bill = await extract_bill_from_receipt(ocr_text)
    if bill:
        transaction = Transaction(
            amount=float(bill["amount"]),
            category=str(bill.get("category", "其他支出")),
            note=bill.get("note") or "",
            type="income" if bill.get("type") == "income" else "expense",
            occurred_at=bill.get("occurred_at")
            or datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        )
        log.info(
            "ocr.parsed",
            amount=transaction.amount,
            category=transaction.category,
        )
        return OcrResponse(data=OcrBillData(transaction=transaction))

    log.info("ocr.silicon_fail", ocr_text_len=len(ocr_text.encode()))
    return OcrResponse(
        data=OcrErrorData(message="无法识别小票内容，请手动记账。")
    )


# ── SSE 流式端点 ─────────────────────────────────────


@router.post("/stream")
async def record_ocr_stream(body: OcrRequest):
    async def event_generator() -> AsyncGenerator[str]:
        try:
            ocr_text = await asyncio.to_thread(
                recognize_receipt, body.imageBase64
            )
            if not ocr_text.strip():
                log.warning("ocr.stream.empty")
                yield sse_line(
                    StreamTextEvent(
                        content="无法识别小票内容，请确保图片清晰后重试。"
                    )
                )
                return

            extract_task = asyncio.create_task(
                extract_bill_from_receipt(ocr_text)
            )
            try:
                async for chunk in narrate_ocr_stream(ocr_text[:200]):
                    yield sse_line(StreamChunkEvent(text=chunk))
            except Exception:
                log.exception("ocr.stream.narrate_failed")

            try:
                bill = await extract_task
            except Exception:
                log.exception("ocr.stream.extract_failed")
                bill = None

            if bill:
                transaction = Transaction(
                    amount=float(bill["amount"]),
                    category=str(bill.get("category", "其他支出")),
                    note=bill.get("note") or "",
                    type="income"
                    if bill.get("type") == "income"
                    else "expense",
                    occurred_at=bill.get("occurred_at")
                    or datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                )
                log.info(
                    "ocr.stream.parsed",
                    amount=transaction.amount,
                    category=transaction.category,
                )
                yield sse_line(StreamBillEvent(transaction=transaction))
            else:
                log.info(
                    "ocr.stream.silicon_fail",
                    ocr_text_len=len(ocr_text.encode()),
                )
                yield sse_line(
                    StreamTextEvent(content="无法识别小票内容，请手动记账。")
                )
        except Exception:
            log.exception("ocr.stream.unhandled")
            yield sse_line(StreamErrorEvent(message="处理失败，请稍后再试。"))
        finally:
            yield SSE_DONE

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

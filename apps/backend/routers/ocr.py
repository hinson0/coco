import structlog
from fastapi import APIRouter

from schemas.ocr import (
    OcrBillData,
    OcrErrorData,
    OcrRequest,
    OcrResponse,
    Transaction,
)
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
            occurred_at=bill.get("occurred_at", ""),
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

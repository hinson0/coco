import re
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter
from schemas.ocr import (
    OcrBillData,
    OcrErrorData,
    OcrRequest,
    OcrResponse,
    OcrTextData,
    Transaction,
)
from services.tencent import recognize_receipt

log = structlog.get_logger()

router = APIRouter(prefix="/record-ocr", tags=["ocr"])


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
        y, m, d = (
            date_match.group(1),
            date_match.group(2).zfill(2),
            date_match.group(3).zfill(2),
        )
        date = f"{y}-{m}-{d}T00:00:00Z"
    else:
        date = None

    return {"amount": amount, "merchant": merchant, "date": date}


@router.post("", response_model=OcrResponse)
async def record_ocr(body: OcrRequest):
    ocr_text = recognize_receipt(body.imageBase64)
    if not ocr_text.strip():
        log.warning("ocr.empty")
        return OcrResponse(
            data=OcrErrorData(message="无法识别小票内容，请确保图片清晰后重试。")
        )

    info = extract_receipt_info(ocr_text)

    if info["amount"] and info["amount"] > 0:
        transaction = Transaction(
            amount=info["amount"],
            category="购物",
            note=info["merchant"] or "",
            type="expense",
            occurred_at=info["date"] or datetime.now(timezone.utc).isoformat(),
        )
        data = OcrBillData(transaction=transaction)
        log.info(
            "ocr.parsed",
            amount=info["amount"],
            merchant=info["merchant"],
            date=info["date"],
        )
        return OcrResponse(data=data)

    data = OcrTextData(ocrText=ocr_text, merchant=info["merchant"])
    log.info("ocr.no_amount", ocr_text_len=len(ocr_text.encode()))
    return OcrResponse(data=data)

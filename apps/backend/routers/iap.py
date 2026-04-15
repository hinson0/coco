"""iOS In-App Purchase receipt 验证和 Pro 激活。

流程：前端购买完成 → 发送 receipt 到此接口 → 服务端向 Apple 验证 →
验证通过则更新 users.pro_expires_at → 返回最新 Pro 状态。
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from infra.config import settings
from infra.database import get_db
from infra.security import get_current_user
from routers.auth import get_pro_status
from schemas.auth import ProStatus

log = structlog.get_logger()
router = APIRouter(prefix="/iap", tags=["iap"])

APPLE_VERIFY_URL_PROD = "https://buy.itunes.apple.com/verifyReceipt"
APPLE_VERIFY_URL_SANDBOX = "https://sandbox.itunes.apple.com/verifyReceipt"

# 产品 ID → 套餐映射（与前端 lib/iap/products.ts 保持一致）
PRODUCT_PLAN_MAP: dict[str, str] = {
    "com.coco.pro.monthly": "monthly",
    "com.coco.pro.yearly": "yearly",
    "com.coco.pro.lifetime": "lifetime",
}

# 套餐 → 有效期天数（lifetime 用 9999 年表示）
PLAN_DURATION_DAYS: dict[str, int] = {
    "monthly": 30,
    "yearly": 365,
    "lifetime": 0,  # 特殊处理
}

# 套餐 → 价格（分）
PLAN_AMOUNT_CENTS: dict[str, int] = {
    "monthly": 1000,
    "yearly": 8800,
    "lifetime": 13800,
}


class VerifyReceiptRequest(BaseModel):
    receipt_data: str  # base64 编码的 transactionReceipt
    product_id: str  # 购买的产品 ID


class VerifyReceiptResponse(BaseModel):
    success: bool
    pro_status: ProStatus
    message: str


@router.post("/verify-receipt", response_model=VerifyReceiptResponse)
async def verify_receipt(
    body: VerifyReceiptRequest,
    user_id: Annotated[str, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> VerifyReceiptResponse:
    """验证 Apple IAP receipt 并激活 Pro。"""

    if not settings.apple_shared_secret:
        raise HTTPException(
            status_code=503,
            detail="支付服务尚未配置，请联系开发者",
        )

    plan = PRODUCT_PLAN_MAP.get(body.product_id)
    if not plan:
        raise HTTPException(status_code=400, detail="未知的产品 ID")

    # 1. 向 Apple 验证 receipt
    apple_data = await _verify_with_apple(body.receipt_data)

    # 2. 提取 transaction_id 防重复
    transaction_id = _extract_transaction_id(apple_data, body.product_id)
    existing = await db.execute(
        text(
            "SELECT id FROM payment_orders "
            "WHERE transaction_id = :tid AND status = 'verified'"
        ),
        {"tid": transaction_id},
    )
    if existing.scalar_one_or_none() is not None:
        # 已验证过，直接返回当前状态
        pro_status = await get_pro_status(db, user_id)
        return VerifyReceiptResponse(
            success=True, pro_status=pro_status, message="此交易已验证过"
        )

    # 3. 创建订单记录
    await db.execute(
        text("""
            INSERT INTO payment_orders
                (user_id, platform, plan, transaction_id, receipt_data, status, amount_cents)
            VALUES
                (:user_id, 'apple', :plan, :tid, :receipt, 'verified', :amount)
        """),
        {
            "user_id": user_id,
            "plan": plan,
            "tid": transaction_id,
            "receipt": body.receipt_data[:200],  # 只存前 200 字符，完整 receipt 太长
            "amount": PLAN_AMOUNT_CENTS.get(plan, 0),
        },
    )

    # 4. 更新 users.pro_expires_at
    if plan == "lifetime":
        new_expires = "9999-12-31T23:59:59+00:00"
    else:
        days = PLAN_DURATION_DAYS[plan]
        # 如果用户已有 Pro 且未过期，在现有到期时间上续费
        current = await db.execute(
            text("SELECT pro_expires_at FROM users WHERE id = :id"),
            {"id": user_id},
        )
        row = current.mappings().one()
        base = row["pro_expires_at"]
        now = datetime.now(UTC)
        if base and base > now:
            new_expires = (base + timedelta(days=days)).isoformat()
        else:
            new_expires = (now + timedelta(days=days)).isoformat()

    await db.execute(
        text("UPDATE users SET pro_expires_at = :exp WHERE id = :id"),
        {"exp": new_expires, "id": user_id},
    )
    await db.commit()

    log.info("iap.verified", user_id=user_id, plan=plan, transaction_id=transaction_id)

    pro_status = await get_pro_status(db, user_id)
    return VerifyReceiptResponse(
        success=True, pro_status=pro_status, message="购买成功，Pro 已激活！"
    )


@router.post("/restore", response_model=VerifyReceiptResponse)
async def restore_purchases(
    body: VerifyReceiptRequest,
    user_id: Annotated[str, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> VerifyReceiptResponse:
    """恢复购买（换设备后）。逻辑与 verify-receipt 相同。"""
    return await verify_receipt(body, user_id, db)


async def _verify_with_apple(receipt_data: str) -> dict:
    """向 Apple 验证 receipt，自动处理沙盒重试。"""
    payload = {
        "receipt-data": receipt_data,
        "password": settings.apple_shared_secret,
        "exclude-old-transactions": True,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        # 先尝试生产环境
        resp = await client.post(APPLE_VERIFY_URL_PROD, json=payload)
        data = resp.json()

        # status=21007 表示沙盒 receipt 发到了生产，自动重试沙盒
        if data.get("status") == 21007:
            resp = await client.post(APPLE_VERIFY_URL_SANDBOX, json=payload)
            data = resp.json()

    status = data.get("status")
    if status != 0:
        log.warning("iap.apple_verify_failed", status=status)
        raise HTTPException(
            status_code=400,
            detail=f"Apple receipt 验证失败 (status={status})",
        )

    return data


def _extract_transaction_id(apple_data: dict, product_id: str) -> str:
    """从 Apple 验证结果中提取 transaction_id。"""
    # 优先从 latest_receipt_info 中找匹配的产品
    receipts = apple_data.get("latest_receipt_info", [])
    for r in receipts:
        if r.get("product_id") == product_id:
            return r.get("transaction_id", "")

    # fallback: 从 in_app 中找
    receipt = apple_data.get("receipt", {})
    in_app = receipt.get("in_app", [])
    for item in in_app:
        if item.get("product_id") == product_id:
            return item.get("transaction_id", "")

    # 最后 fallback: 用第一个 transaction
    if receipts:
        return receipts[0].get("transaction_id", "unknown")
    return "unknown"

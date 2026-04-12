from typing import Annotated

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from infra.database import get_db
from infra.security import get_current_user
from schemas.sync import (
    SyncPullResponse,
    SyncPushRequest,
)

logger = structlog.get_logger()

router = APIRouter(prefix="/sync", tags=["sync"])

UserId = Annotated[str, Depends(get_current_user)]
Db = Annotated[AsyncSession, Depends(get_db)]


@router.post("/push")
async def sync_push(body: SyncPushRequest, user_id: UserId, db: Db) -> dict:
    """接收客户端批量上传，LWW upsert 到 PostgreSQL"""

    logger.debug(f"push body keys:{body.model_dump().keys()}")

    profiles = [r.model_dump() for r in body.user_profiles if r.id == user_id]
    if profiles:
        await db.execute(
            text(
                """
            INSERT INTO user_profiles
                (id, nickname, avatar_type, avatar_value, created_at, updated_at)
            VALUES
                (:id, :nickname, :avatar_type, :avatar_value, :created_at, :updated_at)
            ON CONFLICT (id) DO UPDATE SET
                nickname = EXCLUDED.nickname,
                avatar_type = EXCLUDED.avatar_type,
                avatar_value = EXCLUDED.avatar_value,
                updated_at = EXCLUDED.updated_at
            WHERE EXCLUDED.updated_at > user_profiles.updated_at
        """
            ),
            profiles,
        )

    categories = [
        r.model_dump()
        for r in body.categories
        if r.user_id == user_id or r.user_id is None
    ]
    if categories:
        await db.execute(
            text(
                """
            INSERT INTO categories (id, user_id, name, icon, type, is_default, deleted_at, updated_at)
            VALUES (:id, :user_id, :name, :icon, :type, :is_default, :deleted_at, :updated_at)
            ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, icon = EXCLUDED.icon, type = EXCLUDED.type,
            is_default = EXCLUDED.is_default, deleted_at = EXCLUDED.deleted_at,
            updated_at = EXCLUDED.updated_at
            WHERE EXCLUDED.updated_at > categories.updated_at
        """
            ),
            categories,
        )

    accounts = [r.model_dump() for r in body.accounts if r.user_id == user_id]
    if accounts:
        await db.execute(
            text(
                """
            INSERT INTO accounts (id, user_id, name, icon, type, initial_balance, created_at, updated_at, deleted_at)
            VALUES (:id, :user_id, :name, :icon, :type, :initial_balance, :created_at, :updated_at, :deleted_at)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, icon = EXCLUDED.icon, type = EXCLUDED.type,
                initial_balance = EXCLUDED.initial_balance, updated_at = EXCLUDED.updated_at,
                deleted_at = EXCLUDED.deleted_at
            WHERE EXCLUDED.updated_at > accounts.updated_at
            """
            ),
            accounts,
        )

    budgets = [r.model_dump() for r in body.budgets if r.user_id == user_id]
    if budgets:
        await db.execute(
            text(
                """
            INSERT INTO budgets (id, user_id, category_id, amount, period, start_date, updated_at, deleted_at)
            VALUES (:id, :user_id, :category_id, :amount, :period, :start_date, :updated_at, :deleted_at)
            ON CONFLICT (id) DO UPDATE SET
                category_id = EXCLUDED.category_id, amount = EXCLUDED.amount,
                period = EXCLUDED.period, start_date = EXCLUDED.start_date,
                updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at
            WHERE EXCLUDED.updated_at > budgets.updated_at
            """
            ),
            budgets,
        )

    txns = [r.model_dump() for r in body.transactions if r.user_id == user_id]
    if txns:
        await db.execute(
            text(
                """
            INSERT INTO transactions
                (id, user_id, category_id, amount, type, note, occurred_at, source,
                 raw_input, receipt_url, ai_confidence, created_at, updated_at, deleted_at, account_id)
            VALUES
                (:id, :user_id, :category_id, :amount, :type, :note, :occurred_at, :source,
                 :raw_input, :receipt_url, :ai_confidence, :created_at, :updated_at, :deleted_at, :account_id)
            ON CONFLICT (id) DO UPDATE SET
                category_id = EXCLUDED.category_id, amount = EXCLUDED.amount, type = EXCLUDED.type,
                note = EXCLUDED.note, occurred_at = EXCLUDED.occurred_at, source = EXCLUDED.source,
                raw_input = EXCLUDED.raw_input, receipt_url = EXCLUDED.receipt_url,
                ai_confidence = EXCLUDED.ai_confidence, updated_at = EXCLUDED.updated_at,
                deleted_at = EXCLUDED.deleted_at, account_id = EXCLUDED.account_id
            WHERE EXCLUDED.updated_at > transactions.updated_at
            """
            ),
            txns,
        )

    msgs = [r.model_dump() for r in body.chat_messages if r.user_id == user_id]
    if msgs:
        await db.execute(
            text(
                """
            INSERT INTO chat_messages
                (id, user_id, role, content_type, content, transaction_id,
                 created_at, updated_at, deleted_at, audio_uri, duration_seconds)
            VALUES
                (:id, :user_id, :role, :content_type, :content, :transaction_id,
                 :created_at, :updated_at, :deleted_at, :audio_uri, :duration_seconds)
            ON CONFLICT (id) DO UPDATE SET
                content = EXCLUDED.content, updated_at = EXCLUDED.updated_at, 
                deleted_at = EXCLUDED.deleted_at,
                transaction_id = EXCLUDED.transaction_id
            WHERE EXCLUDED.updated_at > chat_messages.updated_at
            """
            ),
            msgs,
        )

    await db.commit()
    return {"ok": True}


@router.get("/pull", response_model=SyncPullResponse)
async def sync_pull(user_id: UserId, db: Db) -> SyncPullResponse:
    """返回该用户在 PostgreSQL 的全量数据"""

    def rows(result) -> list[dict]:
        return [dict(row) for row in result.mappings().all()]

    transactions = rows(
        await db.execute(
            text("SELECT * FROM transactions WHERE user_id = :uid"),
            {"uid": user_id},
        )
    )
    categories = rows(
        await db.execute(
            text(
                "SELECT * FROM categories WHERE user_id = :uid OR user_id IS NULL"
            ),
            {"uid": user_id},
        )
    )
    budgets = rows(
        await db.execute(
            text("SELECT * FROM budgets WHERE user_id = :uid"), {"uid": user_id}
        )
    )
    chat_messages = rows(
        await db.execute(
            text("SELECT * FROM chat_messages WHERE user_id = :uid"),
            {"uid": user_id},
        )
    )
    accounts = rows(
        await db.execute(
            text("SELECT * FROM accounts WHERE user_id = :uid"),
            {"uid": user_id},
        )
    )
    user_profiles = rows(
        await db.execute(
            text("SELECT * FROM user_profiles WHERE id = :uid"),
            {"uid": user_id},
        )
    )

    return SyncPullResponse.model_validate(
        {
            "transactions": transactions,
            "categories": categories,
            "budgets": budgets,
            "chat_messages": chat_messages,
            "accounts": accounts,
            "user_profiles": user_profiles,
        }
    )

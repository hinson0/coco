from typing import Annotated

from fastapi import APIRouter, Depends
from infra.database import get_db
from infra.security import get_current_user
from schemas.sync import (
    AccountRow,
    BudgetRow,
    CategoryRow,
    ChatMessageRow,
    SyncPullResponse,
    SyncPushRequest,
    TransactionRow,
    UserProfileRow,
)
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/sync", tags=["sync"])

UserId = Annotated[str, Depends(get_current_user)]
Db = Annotated[AsyncSession, Depends(get_db)]


@router.post("/push")
async def sync_push(body: SyncPushRequest, user_id: UserId, db: Db) -> dict:
    """接收客户端批量上传，LWW upsert 到 PostgreSQL"""

    for r in body.user_profiles:
        if r.id != user_id:
            continue
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
            r.model_dump(),
        )

    for r in body.categories:
        if r.user_id is not None and r.user_id != user_id:
            continue
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
            r.model_dump(),
        )

    for r in body.accounts:
        if r.user_id != user_id:
            continue
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
            r.model_dump(),
        )

    for r in body.budgets:
        if r.user_id != user_id:
            continue
        await db.execute(
            text(
                """
            INSERT INTO budgets (id, user_id, category_id, amount, period, start_date, updated_at)
            VALUES (:id, :user_id, :category_id, :amount, :period, :start_date, :updated_at)
            ON CONFLICT (id) DO UPDATE SET
            category_id = EXCLUDED.category_id, amount = EXCLUDED.amount,
            period = EXCLUDED.period, start_date = EXCLUDED.start_date,
            updated_at = EXCLUDED.updated_at
            WHERE EXCLUDED.updated_at > budgets.updated_at
        """
            ),
            r.model_dump(),
        )

    for r in body.transactions:
        if r.user_id != user_id:
            continue
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
            r.model_dump(),
        )

    for r in body.chat_messages:
        if r.user_id != user_id:
            continue
        await db.execute(
            text(
                """
            INSERT INTO chat_messages
            (id, user_id, role, content_type, content, transaction_id,
                created_at, updated_at, audio_uri, duration_seconds)
            VALUES
            (:id, :user_id, :role, :content_type, :content, :transaction_id,
                :created_at, :updated_at, :audio_uri, :duration_seconds)
            ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content, updated_at = EXCLUDED.updated_at,
            transaction_id = EXCLUDED.transaction_id
            WHERE EXCLUDED.updated_at > chat_messages.updated_at
        """
            ),
            r.model_dump(),
        )

    await db.commit()
    return {"ok": True}


@router.get("/pull", response_model=SyncPullResponse)
async def sync_pull(user_id: UserId, db: Db) -> SyncPullResponse:
    """返回该用户在 PostgreSQL 的全量数据"""

    def rows(result) -> list[dict]:
        keys = result.keys()
        return [dict(zip(keys, row)) for row in result.fetchall()]

    def serialize(items: list[dict]) -> list[dict]:
        result = []
        for item in items:
            serialized = {}
            for k, v in item.items():
                serialized[k] = v.isoformat() if hasattr(v, "isoformat") else v
            result.append(serialized)
        return result

    transactions = rows(
        await db.execute(
            text("SELECT * FROM transactions WHERE user_id = :uid"), {"uid": user_id}
        )
    )
    categories = rows(
        await db.execute(
            text("SELECT * FROM categories WHERE user_id = :uid OR user_id IS NULL"),
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
            text("SELECT * FROM chat_messages WHERE user_id = :uid"), {"uid": user_id}
        )
    )
    accounts = rows(
        await db.execute(
            text("SELECT * FROM accounts WHERE user_id = :uid"), {"uid": user_id}
        )
    )
    user_profiles = rows(
        await db.execute(
            text("SELECT * FROM user_profiles WHERE id = :uid"), {"uid": user_id}
        )
    )

    return SyncPullResponse(
        transactions=[TransactionRow(**item) for item in serialize(transactions)],
        categories=[CategoryRow(**item) for item in serialize(categories)],
        budgets=[BudgetRow(**item) for item in serialize(budgets)],
        chat_messages=[ChatMessageRow(**item) for item in serialize(chat_messages)],
        accounts=[AccountRow(**item) for item in serialize(accounts)],
        user_profiles=[UserProfileRow(**item) for item in serialize(user_profiles)],
    )

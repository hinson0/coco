"""新增同步支持

Revision ID: 494dc00061d3
Revises: 88e885d59ac9
Create Date: 2026-04-10 19:51:25.991923

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "494dc00061d3"
down_revision: Union[str, Sequence[str], None] = "88e885d59ac9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        -- 1. 补建 accounts 表
        CREATE TABLE IF NOT EXISTS accounts (
        id              uuid PRIMARY KEY,
        user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
        name            text NOT NULL,
        icon            text NOT NULL,
        type            text NOT NULL CHECK(type IN ('cash', 'bank', 'e_wallet', 'credit', 'custom')),
        initial_balance numeric(12,2) NOT NULL DEFAULT 0,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        deleted_at      timestamptz
        );

        -- 2. 补建 user_profiles 表（id = user_id，一对一）
        CREATE TABLE IF NOT EXISTS user_profiles (
        id           uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        nickname     text,
        avatar_type  text NOT NULL DEFAULT 'emoji',
        avatar_value text NOT NULL DEFAULT '🌿',
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
        );

        -- 3. 给已有 4 张表加 updated_at
        ALTER TABLE categories    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
        ALTER TABLE transactions  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
        ALTER TABLE budgets       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

        -- 4. 触发器函数
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
        NEW.updated_at = now();
        RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- 5. 给 6 张表加触发器
        CREATE TRIGGER trg_categories_updated_at
        BEFORE UPDATE ON categories
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();

        CREATE TRIGGER trg_transactions_updated_at
        BEFORE UPDATE ON transactions
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();

        CREATE TRIGGER trg_budgets_updated_at
        BEFORE UPDATE ON budgets
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();

        CREATE TRIGGER trg_chat_messages_updated_at
        BEFORE UPDATE ON chat_messages
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();

        CREATE TRIGGER trg_accounts_updated_at
        BEFORE UPDATE ON accounts
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();

        CREATE TRIGGER trg_user_profiles_updated_at
        BEFORE UPDATE ON user_profiles
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    """)


def downgrade() -> None:
    op.execute("""
        DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON user_profiles;
        DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
        DROP TRIGGER IF EXISTS trg_chat_messages_updated_at ON chat_messages;
        DROP TRIGGER IF EXISTS trg_budgets_updated_at ON budgets;
        DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
        DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
        DROP FUNCTION IF EXISTS set_updated_at;
        ALTER TABLE categories    DROP COLUMN IF EXISTS updated_at;
        ALTER TABLE transactions  DROP COLUMN IF EXISTS updated_at;
        ALTER TABLE budgets       DROP COLUMN IF EXISTS updated_at;
        ALTER TABLE chat_messages DROP COLUMN IF EXISTS updated_at;
        DROP TABLE IF EXISTS user_profiles;
        DROP TABLE IF EXISTS accounts;
    """)

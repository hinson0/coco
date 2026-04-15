"""add_payment_orders

Revision ID: 17324d0e2fb5
Revises: a42832ee9188
Create Date: 2026-04-15 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "17324d0e2fb5"
down_revision: Union[str, Sequence[str], None] = "fe0be7ef44ff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TYPE IF NOT EXISTS payment_platform AS ENUM ('apple', 'wechat', 'alipay');
        CREATE TYPE IF NOT EXISTS payment_status AS ENUM ('pending', 'verified', 'failed');
        CREATE TYPE IF NOT EXISTS plan_type AS ENUM ('monthly', 'yearly', 'lifetime');

        CREATE TABLE IF NOT EXISTS payment_orders (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            platform        payment_platform NOT NULL,
            plan            plan_type NOT NULL,
            transaction_id  text,
            receipt_data    text,
            status          payment_status NOT NULL DEFAULT 'pending',
            amount_cents    integer NOT NULL,
            currency        text NOT NULL DEFAULT 'CNY',
            verified_at     timestamptz,
            created_at      timestamptz NOT NULL DEFAULT now(),
            updated_at      timestamptz NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_payment_orders_user
            ON payment_orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_payment_orders_transaction
            ON payment_orders(transaction_id);
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS payment_orders;
        DROP TYPE IF EXISTS plan_type;
        DROP TYPE IF EXISTS payment_status;
        DROP TYPE IF EXISTS payment_platform;
    """)

"""initial schema

Revision ID: 88e885d59ac9
Revises:
Create Date: 2026-04-09 14:44:36.422915

"""
from alembic import op


revision: str = "88e885d59ac9"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute("""
        -- Enums
        CREATE TYPE IF NOT EXISTS transaction_type AS ENUM ('income', 'expense');
        CREATE TYPE IF NOT EXISTS record_source AS ENUM ('manual', 'ocr', 'asr', 'text');
        CREATE TYPE IF NOT EXISTS budget_period AS ENUM ('weekly', 'monthly', 'yearly');
        CREATE TYPE IF NOT EXISTS chat_role AS ENUM ('user', 'assistant');
        CREATE TYPE IF NOT EXISTS chat_content_type AS ENUM ('text', 'audio', 'image', 'bill_card', 'nl_result');

        -- Users
        CREATE TABLE IF NOT EXISTS users (
          id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          email      text NOT NULL UNIQUE,
          password   text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );

        -- Categories
        CREATE TABLE IF NOT EXISTS categories (
          id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
          name       text NOT NULL,
          icon       text NOT NULL DEFAULT '📦',
          type       transaction_type NOT NULL,
          is_default boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now()
        );

        -- Transactions
        CREATE TABLE IF NOT EXISTS transactions (
          id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          category_id   uuid NOT NULL REFERENCES categories(id),
          amount        numeric(12,2) NOT NULL,
          type          transaction_type NOT NULL,
          note          text NOT NULL DEFAULT '',
          occurred_at   timestamptz NOT NULL DEFAULT now(),
          source        record_source NOT NULL DEFAULT 'manual',
          raw_input     text,
          receipt_url   text,
          ai_confidence real,
          created_at    timestamptz NOT NULL DEFAULT now(),
          deleted_at    timestamptz
        );

        CREATE INDEX IF NOT EXISTS idx_transactions_user_occurred
          ON transactions (user_id, occurred_at DESC)
          WHERE deleted_at IS NULL;

        -- Budgets
        CREATE TABLE IF NOT EXISTS budgets (
          id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          category_id uuid REFERENCES categories(id),
          amount      numeric(12,2) NOT NULL,
          period      budget_period NOT NULL DEFAULT 'monthly',
          start_date  date NOT NULL,
          created_at  timestamptz NOT NULL DEFAULT now(),
          UNIQUE (user_id, category_id, period)
        );

        -- Chat Messages
        CREATE TABLE IF NOT EXISTS chat_messages (
          id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role           chat_role NOT NULL,
          content_type   chat_content_type NOT NULL DEFAULT 'text',
          content        text NOT NULL,
          transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
          created_at     timestamptz NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
          ON chat_messages (user_id, created_at DESC);

        -- NL Query Logs
        CREATE TABLE IF NOT EXISTS nl_query_logs (
          id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          question       text NOT NULL,
          generated_sql  text NOT NULL,
          result_summary text,
          created_at     timestamptz NOT NULL DEFAULT now()
        );

        -- Seed default categories
        INSERT INTO categories (user_id, name, icon, type, is_default) VALUES
          (NULL, '餐饮', '🍔', 'expense', true),
          (NULL, '交通', '🚗', 'expense', true),
          (NULL, '购物', '🛒', 'expense', true),
          (NULL, '娱乐', '🎮', 'expense', true),
          (NULL, '居住', '🏠', 'expense', true),
          (NULL, '医疗', '💊', 'expense', true),
          (NULL, '教育', '📚', 'expense', true),
          (NULL, '通讯', '📱', 'expense', true),
          (NULL, '工资', '💰', 'income', true),
          (NULL, '理财', '📈', 'income', true),
          (NULL, '其他收入', '💵', 'income', true),
          (NULL, '其他支出', '📦', 'expense', true)
        ON CONFLICT DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS nl_query_logs CASCADE;
        DROP TABLE IF EXISTS chat_messages CASCADE;
        DROP TABLE IF EXISTS budgets CASCADE;
        DROP TABLE IF EXISTS transactions CASCADE;
        DROP TABLE IF EXISTS categories CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP TYPE IF EXISTS chat_content_type;
        DROP TYPE IF EXISTS chat_role;
        DROP TYPE IF EXISTS budget_period;
        DROP TYPE IF EXISTS record_source;
        DROP TYPE IF EXISTS transaction_type;
    """)

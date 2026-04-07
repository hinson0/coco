-- Enums
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE record_source AS ENUM ('manual', 'ocr', 'asr', 'text');
CREATE TYPE budget_period AS ENUM ('weekly', 'monthly', 'yearly');
CREATE TYPE chat_role AS ENUM ('user', 'assistant');
CREATE TYPE chat_content_type AS ENUM ('text', 'audio', 'image', 'bill_card', 'nl_result');

-- Users（替换 Supabase auth.users）
CREATE TABLE users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  password   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Categories
CREATE TABLE categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  icon       text NOT NULL DEFAULT '📦',
  type       transaction_type NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Transactions
CREATE TABLE transactions (
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

CREATE INDEX idx_transactions_user_occurred
  ON transactions (user_id, occurred_at DESC)
  WHERE deleted_at IS NULL;

-- Budgets
CREATE TABLE budgets (
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
CREATE TABLE chat_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role           chat_role NOT NULL,
  content_type   chat_content_type NOT NULL DEFAULT 'text',
  content        text NOT NULL,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_user_created ON chat_messages (user_id, created_at DESC);

-- NL Query Logs
CREATE TABLE nl_query_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question       text NOT NULL,
  generated_sql  text NOT NULL,
  result_summary text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- Enums
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE record_source AS ENUM ('manual', 'ocr', 'asr', 'text');
CREATE TYPE budget_period AS ENUM ('weekly', 'monthly', 'yearly');
CREATE TYPE chat_role AS ENUM ('user', 'assistant');
CREATE TYPE chat_content_type AS ENUM ('text', 'audio', 'image', 'bill_card', 'nl_result');

-- Categories
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '📦',
  type transaction_type NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select" ON categories FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "categories_insert" ON categories FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_default = false);
CREATE POLICY "categories_update" ON categories FOR UPDATE
  USING (user_id = auth.uid() AND is_default = false);
CREATE POLICY "categories_delete" ON categories FOR DELETE
  USING (user_id = auth.uid() AND is_default = false);

-- Transactions
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id),
  amount numeric(12,2) NOT NULL,
  type transaction_type NOT NULL,
  note text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source record_source NOT NULL DEFAULT 'manual',
  raw_input text,
  receipt_url text,
  ai_confidence real,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select" ON transactions FOR SELECT
  USING (user_id = auth.uid() AND deleted_at IS NULL);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "transactions_update" ON transactions FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "transactions_delete" ON transactions FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX idx_transactions_user_occurred
  ON transactions (user_id, occurred_at DESC)
  WHERE deleted_at IS NULL;

-- Budgets
CREATE TABLE budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id),
  amount numeric(12,2) NOT NULL,
  period budget_period NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, period)
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets_all" ON budgets FOR ALL USING (user_id = auth.uid());

-- Chat Messages
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role chat_role NOT NULL,
  content_type chat_content_type NOT NULL DEFAULT 'text',
  content text NOT NULL,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_messages_all" ON chat_messages FOR ALL USING (user_id = auth.uid());
CREATE INDEX idx_chat_messages_user_created ON chat_messages (user_id, created_at DESC);

-- NL Query Logs
CREATE TABLE nl_query_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  generated_sql text NOT NULL,
  result_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nl_query_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nl_query_logs_all" ON nl_query_logs FOR ALL USING (user_id = auth.uid());

-- NL 查询用只读 SQL 执行函数
CREATE OR REPLACE FUNCTION exec_readonly_sql(sql_query text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result json;
BEGIN
  EXECUTE sql_query INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION exec_readonly_sql FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exec_readonly_sql TO service_role;

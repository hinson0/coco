// apps/mobile/lib/db/schema.ts
import type * as SQLite from "expo-sqlite";

const CREATE_CATEGORIES = `
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    is_default INTEGER DEFAULT 1
  );
`;

const CREATE_TRANSACTIONS = `
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    category_id TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    note TEXT DEFAULT '',
    occurred_at TEXT NOT NULL,
    source TEXT DEFAULT 'manual',
    raw_input TEXT,
    receipt_url TEXT,
    ai_confidence REAL,
    created_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
`;

const CREATE_BUDGETS = `
  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    category_id TEXT,
    amount REAL NOT NULL,
    period TEXT NOT NULL CHECK(period IN ('weekly', 'monthly', 'yearly')),
    start_date TEXT NOT NULL
  );
`;

const CREATE_CHAT_MESSAGES = `
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content_type TEXT NOT NULL,
    content TEXT NOT NULL,
    transaction_id TEXT,
    created_at TEXT NOT NULL
  );
`;

export async function createTables(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(CREATE_CATEGORIES);
  await db.execAsync(CREATE_TRANSACTIONS);
  await db.execAsync(CREATE_BUDGETS);
  await db.execAsync(CREATE_CHAT_MESSAGES);
}

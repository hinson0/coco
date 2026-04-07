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

// 用户个人资料表（头像 + 昵称，本地存储 + 后台同步到 Supabase）
const CREATE_USER_PROFILES = `
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      nickname TEXT,
      avatar_type TEXT NOT NULL DEFAULT 'emoji',
      avatar_value TEXT NOT NULL DEFAULT '🌿',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `;

// 资金账户表（多账户余额追踪）
const CREATE_ACCOUNTS = `
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('cash', 'bank', 'e_wallet', 'credit', 'custom')),
      initial_balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      deleted_at TEXT
    );
  `;

export async function createTables(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(CREATE_CATEGORIES);
  await db.execAsync(CREATE_TRANSACTIONS);
  await db.execAsync(CREATE_BUDGETS);
  await db.execAsync(CREATE_CHAT_MESSAGES);
  await db.execAsync(CREATE_USER_PROFILES); // 新增
  await db.execAsync(CREATE_ACCOUNTS); // 新增
  await runMigrations(db); // 新增
}

// 增量迁移：给已有表添加新字段（幂等，重复执行不报错）
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await addColumnIfNotExists(db, "categories", "deleted_at", "TEXT");
  await addColumnIfNotExists(
    db,
    "transactions",
    "account_id",
    "TEXT REFERENCES accounts(id)",
  );
  // 清理已有重复分类（保留最早创建的，软删除其余），然后建唯一索引
  await db.execAsync(`
    UPDATE categories SET deleted_at = datetime('now')
    WHERE deleted_at IS NULL
      AND rowid NOT IN (
        SELECT MIN(rowid) FROM categories
        WHERE deleted_at IS NULL
        GROUP BY name, type
      )
  `);
  await db.execAsync(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_type ON categories(name, type) WHERE deleted_at IS NULL"
  );
  // 语音消息字段
  await addColumnIfNotExists(db, "chat_messages", "audio_uri", "TEXT");
  await addColumnIfNotExists(db, "chat_messages", "duration_seconds", "INTEGER");
  // 聊天消息按时间排序的索引，加速 ORDER BY created_at DESC LIMIT 查询
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC)"
  );
}

async function addColumnIfNotExists(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const info = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );
  if (!info.some((col) => col.name === column)) {
    await db.execAsync(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
    );
  }
}

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

// 用户个人资料表（头像 + 昵称，本地存储）
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
  // GROUP BY 包含 user_id，不同用户可以有同名分类
  await db.execAsync(`
    UPDATE categories SET deleted_at = datetime('now')
    WHERE deleted_at IS NULL
      AND rowid NOT IN (
        SELECT MIN(rowid) FROM categories
        WHERE deleted_at IS NULL
        GROUP BY name, type, user_id
      )
  `);
  // 重建索引：加入 user_id 以支持多用户同名分类
  await db.execAsync("DROP INDEX IF EXISTS idx_categories_name_type");
  await db.execAsync(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_type ON categories(name, type, user_id) WHERE deleted_at IS NULL",
  );
  // 语音消息字段
  await addColumnIfNotExists(db, "chat_messages", "audio_uri", "TEXT");
  await addColumnIfNotExists(
    db,
    "chat_messages",
    "duration_seconds",
    "INTEGER",
  );
  // user_id 索引（多用户数据隔离）
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)",
  );
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id)",
  );
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)",
  );
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id)",
  );
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)",
  );
  // 聊天消息按时间排序的索引，加速 ORDER BY created_at DESC LIMIT 查询
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC)",
  );

  // ── 同步支持：给各表加 updated_at ──
  await addColumnIfNotExists(db, "transactions", "updated_at", "TEXT");
  await db.execAsync(
    `UPDATE transactions SET updated_at = created_at WHERE updated_at IS NULL`,
  );

  await addColumnIfNotExists(db, "categories", "updated_at", "TEXT");
  await db.execAsync(
    `UPDATE categories SET updated_at = datetime('now') WHERE updated_at IS NULL`,
  );

  await addColumnIfNotExists(db, "budgets", "updated_at", "TEXT");
  await db.execAsync(
    `UPDATE budgets SET updated_at = datetime('now') WHERE updated_at IS NULL`,
  );

  await addColumnIfNotExists(db, "budgets", "deleted_at", "TEXT");

  await addColumnIfNotExists(db, "chat_messages", "updated_at", "TEXT");
  await db.execAsync(
    `UPDATE chat_messages SET updated_at = created_at WHERE updated_at IS NULL`,
  );

  await addColumnIfNotExists(db, "chat_messages", "deleted_at", "TEXT");

  await addColumnIfNotExists(db, "accounts", "updated_at", "TEXT");
  await db.execAsync(
    `UPDATE accounts SET updated_at = created_at WHERE updated_at IS NULL`,
  );

  // ── 同步水位线表 ──
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_watermarks (
      table_name   TEXT PRIMARY KEY,
      last_push_at TEXT,
      last_pull_at TEXT
    )
  `);
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

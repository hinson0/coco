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

const CREATE_AD_WATCH_LOGS = `
  CREATE TABLE IF NOT EXISTS ad_watch_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watched_at TEXT NOT NULL,
    ad_type TEXT NOT NULL CHECK(ad_type IN ('rewarded_video', 'splash')),
    slot_id TEXT,
    duration_sec INTEGER
  );
`;

const CREATE_ENTITLEMENTS = `
  CREATE TABLE IF NOT EXISTS entitlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feature TEXT NOT NULL UNIQUE CHECK(feature IN ('asr', 'ocr', 'multi_account', 'csv_export')),
    balance INTEGER NOT NULL DEFAULT 0,
    total_earned INTEGER NOT NULL DEFAULT 0,
    last_decay_at TEXT
  );
`;

export async function createTables(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(CREATE_CATEGORIES);
  await db.execAsync(CREATE_TRANSACTIONS);
  await db.execAsync(CREATE_BUDGETS);
  await db.execAsync(CREATE_CHAT_MESSAGES);
  await db.execAsync(CREATE_USER_PROFILES); // 新增
  await db.execAsync(CREATE_ACCOUNTS); // 新增
  await db.execAsync(CREATE_AD_WATCH_LOGS);
  await db.execAsync(CREATE_ENTITLEMENTS);
  await runMigrations(db); // 新增
}

// 增量迁移：给已有表添加新字段（幂等，重复执行不报错）
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // ── 批量添加新列（每表一次 PRAGMA，5 次代替原先 11 次） ──
  await addColumnsIfNotExist(db, "categories", [
    { name: "deleted_at", definition: "TEXT" },
    { name: "updated_at", definition: "TEXT" },
  ]);
  await addColumnsIfNotExist(db, "transactions", [
    { name: "account_id", definition: "TEXT REFERENCES accounts(id)" },
    { name: "updated_at", definition: "TEXT" },
  ]);
  await addColumnsIfNotExist(db, "chat_messages", [
    { name: "audio_uri", definition: "TEXT" },
    { name: "duration_seconds", definition: "INTEGER" },
    { name: "updated_at", definition: "TEXT" },
    { name: "deleted_at", definition: "TEXT" },
  ]);
  await addColumnsIfNotExist(db, "budgets", [
    { name: "updated_at", definition: "TEXT" },
    { name: "deleted_at", definition: "TEXT" },
  ]);
  await addColumnsIfNotExist(db, "accounts", [
    { name: "updated_at", definition: "TEXT" },
  ]);

  // ── 重复分类清理 + 唯一索引 ──
  await db.execAsync(`
    UPDATE categories SET deleted_at = datetime('now')
    WHERE deleted_at IS NULL
      AND rowid NOT IN (
        SELECT MIN(rowid) FROM categories
        WHERE deleted_at IS NULL
        GROUP BY name, type, user_id
      )
  `);
  await db.execAsync("DROP INDEX IF EXISTS idx_categories_name_type");
  await db.execAsync(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_type ON categories(name, type, user_id) WHERE deleted_at IS NULL",
  );

  // ── 索引 ──
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
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC)",
  );

  // ── 默认值回填（列已在上面批量添加） ──
  await db.execAsync(
    `UPDATE transactions SET updated_at = created_at WHERE updated_at IS NULL`,
  );
  await db.execAsync(
    `UPDATE categories SET updated_at = datetime('now') WHERE updated_at IS NULL`,
  );
  await db.execAsync(
    `UPDATE budgets SET updated_at = datetime('now') WHERE updated_at IS NULL`,
  );
  await db.execAsync(
    `UPDATE chat_messages SET updated_at = created_at WHERE updated_at IS NULL`,
  );
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

  // ── 自动记账待确认队列 ──
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      source TEXT NOT NULL,
      raw_title TEXT,
      raw_text TEXT,
      notification_timestamp INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'dismissed')),
      created_at TEXT NOT NULL,
      confirmed_at TEXT,
      transaction_id TEXT
    )
  `);
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_pending_notifications_status ON pending_notifications(status, user_id)",
  );
  // 部分索引（比单列 idx 更优，避免 user_id 过滤后还要全表 sort）
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_user_active ON chat_messages(user_id, created_at DESC) WHERE deleted_at IS NULL",
  );
}

async function addColumnsIfNotExist(
  db: SQLite.SQLiteDatabase,
  table: string,
  columns: readonly { readonly name: string; readonly definition: string }[],
): Promise<void> {
  const info = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );
  const existing = new Set(info.map((col) => col.name));
  for (const col of columns) {
    if (!existing.has(col.name)) {
      await db.execAsync(
        `ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.definition}`,
      );
    }
  }
}

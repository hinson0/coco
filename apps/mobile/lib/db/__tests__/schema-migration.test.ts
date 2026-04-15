import { openDatabaseAsync } from "expo-sqlite";
import { createTables } from "../schema";

describe("schema migration: updated_at + sync_watermarks", () => {
  async function getColumns(
    db: Awaited<ReturnType<typeof openDatabaseAsync>>,
    table: string,
  ) {
    const rows = await db.getAllAsync<{ name: string }>(
      `PRAGMA table_info(${table})`,
    );
    return rows.map((r) => r.name);
  }

  it("adds updated_at to transactions", async () => {
    const db = await openDatabaseAsync(":memory:");
    await createTables(db);
    const cols = await getColumns(db, "transactions");
    expect(cols).toContain("updated_at");
  });

  it("adds updated_at to categories", async () => {
    const db = await openDatabaseAsync(":memory:");
    await createTables(db);
    const cols = await getColumns(db, "categories");
    expect(cols).toContain("updated_at");
  });

  it("adds updated_at to budgets", async () => {
    const db = await openDatabaseAsync(":memory:");
    await createTables(db);
    const cols = await getColumns(db, "budgets");
    expect(cols).toContain("updated_at");
  });

  it("adds updated_at to chat_messages", async () => {
    const db = await openDatabaseAsync(":memory:");
    await createTables(db);
    const cols = await getColumns(db, "chat_messages");
    expect(cols).toContain("updated_at");
  });

  it("adds updated_at to accounts", async () => {
    const db = await openDatabaseAsync(":memory:");
    await createTables(db);
    const cols = await getColumns(db, "accounts");
    expect(cols).toContain("updated_at");
  });

  it("creates sync_watermarks table with correct columns", async () => {
    const db = await openDatabaseAsync(":memory:");
    await createTables(db);
    const cols = await getColumns(db, "sync_watermarks");
    expect(cols).toContain("table_name");
    expect(cols).toContain("last_push_at");
    expect(cols).toContain("last_pull_at");
  });
});

describe("schema migration: chat_messages 复合部分索引", () => {
  it("idx_chat_messages_user_active 覆盖 user_id/created_at 且为部分索引", async () => {
    const db = await openDatabaseAsync(":memory:");
    await createTables(db);

    const indexes = await db.getAllAsync<{ name: string; sql: string | null }>(
      "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='chat_messages'",
    );
    const sql = indexes
      .find((i) => i.name === "idx_chat_messages_user_active")
      ?.sql?.toLowerCase();

    expect(sql).toBeDefined();
    expect(sql).toContain("user_id");
    expect(sql).toContain("created_at");
    expect(sql).toContain("where deleted_at is null");
  });
});

describe("schema migration: existing data gets updated_at default", () => {
  it("transactions existing rows get updated_at = created_at", async () => {
    const db = await openDatabaseAsync(":memory:");
    // 先建表（不含 updated_at）
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL,
        icon TEXT NOT NULL, type TEXT NOT NULL, is_default INTEGER DEFAULT 1
      )
    `);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY, user_id TEXT, category_id TEXT NOT NULL,
        amount REAL NOT NULL, type TEXT NOT NULL, note TEXT DEFAULT '',
        occurred_at TEXT NOT NULL, source TEXT DEFAULT 'manual',
        raw_input TEXT, receipt_url TEXT, ai_confidence REAL,
        created_at TEXT NOT NULL, deleted_at TEXT,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )
    `);
    // 插入一条没有 updated_at 的旧数据
    await db.runAsync(
      `INSERT INTO categories (id, name, icon, type) VALUES ('cat1', '餐饮', '🍔', 'expense')`,
    );
    await db.runAsync(
      `INSERT INTO transactions (id, category_id, amount, type, note, occurred_at, created_at)
       VALUES ('tx1', 'cat1', 100, 'expense', '', '2026-01-01', '2026-01-01T10:00:00.000Z')`,
    );
    // 跑完整的 createTables（会触发 addColumnIfNotExists + UPDATE default）
    await createTables(db);
    // 验证 updated_at 被填充为 created_at
    const row = await db.getFirstAsync<{ updated_at: string }>(
      "SELECT updated_at FROM transactions WHERE id = 'tx1'",
    );
    expect(row?.updated_at).toBe("2026-01-01T10:00:00.000Z");
  });
});

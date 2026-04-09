import { openDatabaseAsync } from "expo-sqlite";
import { createTables } from "../schema";

describe("schema migration: updated_at + sync_watermarks", () => {
  async function getColumns(db: Awaited<ReturnType<typeof openDatabaseAsync>>, table: string) {
    const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
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

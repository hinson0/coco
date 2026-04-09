import type * as SQLite from "expo-sqlite";

export type SyncTable =
  | "transactions"
  | "categories"
  | "budgets"
  | "chat_messages"
  | "accounts"
  | "user_profiles";

interface WatermarkRow {
  readonly table_name: SyncTable;
  readonly last_push_at: string | null;
  readonly last_pull_at: string | null;
}

export async function getWatermark(
  db: SQLite.SQLiteDatabase,
  table: SyncTable
): Promise<WatermarkRow> {
  const row = await db.getFirstAsync<WatermarkRow>(
    "SELECT * FROM sync_watermarks WHERE table_name = ?",
    table
  );
  return row ?? { table_name: table, last_push_at: null, last_pull_at: null };
}

export async function setLastPushAt(
  db: SQLite.SQLiteDatabase,
  table: SyncTable,
  timestamp: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_watermarks (table_name, last_push_at)
     VALUES (?, ?)
     ON CONFLICT(table_name) DO UPDATE SET last_push_at = excluded.last_push_at`,
    table,
    timestamp
  );
}

export async function setLastPullAt(
  db: SQLite.SQLiteDatabase,
  table: SyncTable,
  timestamp: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_watermarks (table_name, last_pull_at)
     VALUES (?, ?)
     ON CONFLICT(table_name) DO UPDATE SET last_pull_at = excluded.last_pull_at`,
    table,
    timestamp
  );
}

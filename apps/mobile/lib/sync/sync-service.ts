import type * as SQLite from "expo-sqlite";
import { apiFetch } from "@/lib/api";
import { getWatermark, setLastPushAt, setLastPullAt, type SyncTable } from "./watermarks";

type Row = Record<string, unknown>;

const SYNC_TABLES: SyncTable[] = [
  "user_profiles",
  "categories",
  "accounts",
  "budgets",
  "transactions",
  "chat_messages",
];

async function getChangedRows(
  db: SQLite.SQLiteDatabase,
  userId: string,
  table: SyncTable,
  lastPushAt: string | null
): Promise<readonly Row[]> {
  if (table === "user_profiles") {
    if (lastPushAt === null) {
      return db.getAllAsync<Row>(`SELECT * FROM user_profiles WHERE id = ?`, userId);
    }
    return db.getAllAsync<Row>(
      `SELECT * FROM user_profiles WHERE id = ? AND updated_at > ?`,
      userId,
      lastPushAt
    );
  }
  if (lastPushAt === null) {
    return db.getAllAsync<Row>(`SELECT * FROM ${table} WHERE user_id = ?`, userId);
  }
  return db.getAllAsync<Row>(
    `SELECT * FROM ${table} WHERE user_id = ? AND updated_at > ?`,
    userId,
    lastPushAt
  );
}

export async function push(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  const now = new Date().toISOString();
  const payload: Record<string, readonly Row[]> = {};

  for (const table of SYNC_TABLES) {
    const { last_push_at } = await getWatermark(db, table);
    payload[table] = await getChangedRows(db, userId, table, last_push_at);
  }

  await apiFetch<{ ok: boolean }>("/sync/push", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  for (const table of SYNC_TABLES) {
    await setLastPushAt(db, table, now);
  }
}

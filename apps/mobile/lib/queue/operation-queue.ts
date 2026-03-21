// apps/mobile/lib/queue/operation-queue.ts
import * as SQLite from "expo-sqlite";
import { v4 as uuid } from "uuid";

export interface QueueOperation {
  readonly id: string;
  readonly type: "create_transaction" | "update_transaction" | "delete_transaction";
  readonly payload: string;
  readonly status: "pending" | "syncing" | "failed";
  readonly retries: number;
  readonly created_at: number;
  readonly depends_on: string | null;
  readonly error: string | null;
}

export interface EnqueueParams {
  readonly type: QueueOperation["type"];
  readonly payload: Record<string, unknown>;
  readonly dependsOn?: string;
}

export async function initQueue(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS operation_queue (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      payload     TEXT NOT NULL,
      status      TEXT DEFAULT 'pending',
      retries     INTEGER DEFAULT 0,
      created_at  INTEGER NOT NULL,
      depends_on  TEXT,
      error       TEXT
    );
  `);
}

export async function enqueue(
  db: SQLite.SQLiteDatabase,
  params: EnqueueParams
): Promise<string> {
  const id = uuid();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO operation_queue (id, type, payload, status, retries, created_at, depends_on)
     VALUES (?, ?, ?, 'pending', 0, ?, ?)`,
    id,
    params.type,
    JSON.stringify(params.payload),
    now,
    params.dependsOn ?? null
  );
  return id;
}

export async function getPending(
  db: SQLite.SQLiteDatabase
): Promise<readonly QueueOperation[]> {
  return db.getAllAsync<QueueOperation>(
    `SELECT * FROM operation_queue WHERE status = 'pending' ORDER BY created_at ASC`
  );
}

export async function remove(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync(`DELETE FROM operation_queue WHERE id = ?`, id);
}

export async function getCount(
  db: SQLite.SQLiteDatabase
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM operation_queue`
  );
  return row?.count ?? 0;
}

export async function markSyncing(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync(
    `UPDATE operation_queue SET status = 'syncing' WHERE id = ?`,
    id
  );
}

export async function markPending(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync(
    `UPDATE operation_queue SET status = 'pending' WHERE id = ?`,
    id
  );
}

export async function incrementRetry(
  db: SQLite.SQLiteDatabase,
  id: string,
  error: string
): Promise<void> {
  await db.runAsync(
    `UPDATE operation_queue SET status = 'pending', retries = retries + 1, error = ? WHERE id = ?`,
    error,
    id
  );
}

export async function markFailed(
  db: SQLite.SQLiteDatabase,
  id: string,
  error: string
): Promise<void> {
  await db.runAsync(
    `UPDATE operation_queue SET status = 'failed', error = ? WHERE id = ?`,
    error,
    id
  );
}

export async function exists(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM operation_queue WHERE id = ?`,
    id
  );
  return (row?.count ?? 0) > 0;
}

export async function updatePayload(
  db: SQLite.SQLiteDatabase,
  id: string,
  payload: Record<string, unknown>
): Promise<void> {
  await db.runAsync(
    `UPDATE operation_queue SET payload = ? WHERE id = ?`,
    JSON.stringify(payload),
    id
  );
}

export async function markFailedByDependency(
  db: SQLite.SQLiteDatabase,
  dependsOnId: string
): Promise<void> {
  await db.runAsync(
    `UPDATE operation_queue SET status = 'failed', error = 'dependency_failed' WHERE depends_on = ?`,
    dependsOnId
  );
}

export async function resetSyncingToPending(
  db: SQLite.SQLiteDatabase
): Promise<void> {
  await db.runAsync(
    `UPDATE operation_queue SET status = 'pending' WHERE status = 'syncing'`
  );
}

export async function findByTempId(
  db: SQLite.SQLiteDatabase,
  tempId: string
): Promise<QueueOperation | null> {
  return db.getFirstAsync<QueueOperation>(
    `SELECT * FROM operation_queue WHERE type = 'create_transaction' AND payload LIKE ?`,
    `%${tempId}%`
  );
}

export async function getDependents(
  db: SQLite.SQLiteDatabase,
  operationId: string
): Promise<readonly QueueOperation[]> {
  return db.getAllAsync<QueueOperation>(
    `SELECT * FROM operation_queue WHERE depends_on = ?`,
    operationId
  );
}

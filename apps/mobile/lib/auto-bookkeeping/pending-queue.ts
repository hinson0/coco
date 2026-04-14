import * as Crypto from "expo-crypto";
import type * as SQLite from "expo-sqlite";
import type { ParsedNotification } from "./parser";

export interface PendingNotification {
  readonly id: string;
  readonly user_id: string;
  readonly amount: number;
  readonly type: "income" | "expense";
  readonly source: string;
  readonly raw_title: string | null;
  readonly raw_text: string | null;
  readonly notification_timestamp: number;
  readonly status: "pending" | "confirmed" | "dismissed";
  readonly created_at: string;
  readonly confirmed_at: string | null;
  readonly transaction_id: string | null;
}

export async function addPending(
  db: SQLite.SQLiteDatabase,
  userId: string,
  parsed: ParsedNotification,
  notificationTimestamp: number,
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO pending_notifications (id, user_id, amount, type, source, raw_title, raw_text, notification_timestamp, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    id,
    userId,
    parsed.amount,
    parsed.type,
    parsed.source,
    parsed.rawTitle,
    parsed.rawText,
    notificationTimestamp,
    now,
  );

  return id;
}

export async function getPendingList(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<readonly PendingNotification[]> {
  return db.getAllAsync<PendingNotification>(
    `SELECT * FROM pending_notifications WHERE user_id = ? AND status = 'pending' ORDER BY notification_timestamp DESC`,
    userId,
  );
}

export async function confirmPending(
  db: SQLite.SQLiteDatabase,
  id: string,
  transactionId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE pending_notifications SET status = 'confirmed', confirmed_at = ?, transaction_id = ? WHERE id = ?`,
    now,
    transactionId,
    id,
  );
}

export async function dismissPending(
  db: SQLite.SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE pending_notifications SET status = 'dismissed' WHERE id = ?`,
    id,
  );
}

export async function getRecentForDedup(
  db: SQLite.SQLiteDatabase,
  userId: string,
  referenceTimestamp?: number,
  windowMs: number = 10_000,
): Promise<readonly { amount: number; source: string; timestamp: number }[]> {
  const cutoff = (referenceTimestamp ?? Date.now()) - windowMs;
  const rows = await db.getAllAsync<{
    amount: number;
    source: string;
    notification_timestamp: number;
  }>(
    `SELECT amount, source, notification_timestamp FROM pending_notifications
     WHERE user_id = ? AND notification_timestamp > ?
     ORDER BY notification_timestamp DESC`,
    userId,
    cutoff,
  );
  return rows.map((r) => ({
    amount: r.amount,
    source: r.source,
    timestamp: r.notification_timestamp,
  }));
}

export async function getPendingCount(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<number> {
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM pending_notifications WHERE user_id = ? AND status = 'pending'`,
    userId,
  );
  return result?.count ?? 0;
}

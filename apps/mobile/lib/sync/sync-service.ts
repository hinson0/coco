import { apiFetch } from "@/lib/api";
import type * as SQLite from "expo-sqlite";
import {
  getWatermark,
  setLastPullAt,
  setLastPushAt,
  type SyncTable,
} from "./watermarks";

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
  lastPushAt: string | null,
): Promise<readonly Row[]> {
  if (table === "user_profiles") {
    if (lastPushAt === null) {
      return db.getAllAsync<Row>(
        `SELECT * FROM user_profiles WHERE id = ?`,
        userId,
      );
    }
    return db.getAllAsync<Row>(
      `SELECT * FROM user_profiles WHERE id = ? AND updated_at > ?`,
      userId,
      lastPushAt,
    );
  }
  if (lastPushAt === null) {
    return db.getAllAsync<Row>(
      `SELECT * FROM ${table} WHERE user_id = ?`,
      userId,
    );
  }
  return db.getAllAsync<Row>(
    `SELECT * FROM ${table} WHERE user_id = ? AND updated_at > ?`,
    userId,
    lastPushAt,
  );
}

export async function push(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<void> {
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

// ── Pull: 远端数据 LWW 合并到本地 ──

interface SyncPayload {
  readonly user_profiles: readonly Row[];
  readonly categories: readonly Row[];
  readonly accounts: readonly Row[];
  readonly budgets: readonly Row[];
  readonly transactions: readonly Row[];
  readonly chat_messages: readonly Row[];
}

async function upsertUserProfiles(
  db: SQLite.SQLiteDatabase,
  rows: readonly Row[],
): Promise<void> {
  for (const r of rows) {
    await db.runAsync(
      `INSERT INTO user_profiles (id, nickname, avatar_type, avatar_value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         nickname = excluded.nickname, avatar_type = excluded.avatar_type,
         avatar_value = excluded.avatar_value, updated_at = excluded.updated_at
       WHERE excluded.updated_at > user_profiles.updated_at`,
      r.id as string,
      (r.nickname as string) ?? null,
      r.avatar_type as string,
      r.avatar_value as string,
      r.created_at as string,
      r.updated_at as string,
    );
  }
}

async function upsertCategories(
  db: SQLite.SQLiteDatabase,
  rows: readonly Row[],
): Promise<void> {
  for (const r of rows) {
    await db.runAsync(
      `INSERT INTO categories (id, user_id, name, icon, type, is_default, deleted_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         user_id = excluded.user_id, name = excluded.name, icon = excluded.icon,
         type = excluded.type, is_default = excluded.is_default,
         deleted_at = excluded.deleted_at, updated_at = excluded.updated_at
       WHERE excluded.updated_at > categories.updated_at`,
      r.id,
      r.user_id ?? null,
      r.name,
      r.icon,
      r.type,
      r.is_default ?? 0,
      r.deleted_at ?? null,
      r.updated_at,
    );
  }
}

async function upsertAccounts(
  db: SQLite.SQLiteDatabase,
  rows: readonly Row[],
): Promise<void> {
  for (const r of rows) {
    await db.runAsync(
      `INSERT INTO accounts (id, user_id, name, icon, type, initial_balance, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, icon = excluded.icon, type = excluded.type,
         initial_balance = excluded.initial_balance, updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at
       WHERE excluded.updated_at > accounts.updated_at`,
      r.id,
      r.user_id ?? null,
      r.name,
      r.icon,
      r.type,
      r.initial_balance ?? 0,
      r.created_at,
      r.updated_at,
      r.deleted_at ?? null,
    );
  }
}

async function upsertBudgets(
  db: SQLite.SQLiteDatabase,
  rows: readonly Row[],
): Promise<void> {
  for (const r of rows) {
    await db.runAsync(
      `INSERT INTO budgets (id, user_id, category_id, amount, period, start_date, updated_at, deleted_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET
     category_id = excluded.category_id, amount = excluded.amount,
     period = excluded.period, start_date = excluded.start_date,
     updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
   WHERE excluded.updated_at > budgets.updated_at`,
      r.id,
      r.user_id,
      r.category_id ?? null,
      r.amount,
      r.period,
      r.start_date,
      r.updated_at,
      r.deleted_at ?? null,
    );
  }
}

async function upsertTransactions(
  db: SQLite.SQLiteDatabase,
  rows: readonly Row[],
): Promise<void> {
  for (const r of rows) {
    await db.runAsync(
      `INSERT INTO transactions
        (id, user_id, category_id, amount, type, note, occurred_at, source,
         raw_input, receipt_url, ai_confidence, created_at, updated_at, deleted_at, account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         category_id = excluded.category_id, amount = excluded.amount, type = excluded.type,
         note = excluded.note, occurred_at = excluded.occurred_at, source = excluded.source,
         raw_input = excluded.raw_input, receipt_url = excluded.receipt_url,
         ai_confidence = excluded.ai_confidence, updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at, account_id = excluded.account_id
       WHERE excluded.updated_at > transactions.updated_at`,
      r.id,
      r.user_id,
      r.category_id,
      r.amount,
      r.type,
      r.note ?? "",
      r.occurred_at,
      r.source ?? "manual",
      r.raw_input ?? null,
      r.receipt_url ?? null,
      r.ai_confidence ?? null,
      r.created_at,
      r.updated_at,
      r.deleted_at ?? null,
      r.account_id ?? null,
    );
  }
}

async function upsertChatMessages(
  db: SQLite.SQLiteDatabase,
  rows: readonly Row[],
): Promise<void> {
  for (const r of rows) {
    await db.runAsync(
      `INSERT INTO chat_messages
        (id, user_id, role, content_type, content, transaction_id, created_at, updated_at, deleted_at, audio_uri, duration_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         content = excluded.content, updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at, transaction_id = excluded.transaction_id
       WHERE excluded.updated_at > chat_messages.updated_at`,
      r.id,
      r.user_id,
      r.role,
      r.content_type,
      r.content,
      r.transaction_id ?? null,
      r.created_at,
      r.updated_at,
      r.deleted_at ?? null,
      r.audio_uri ?? null,
      r.duration_seconds ?? null,
    );
  }
}

export async function pull(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<void> {
  const data = await apiFetch<SyncPayload>("/sync/pull");
  const now = new Date().toISOString();

  // 按 FK 依赖顺序 upsert
  await upsertUserProfiles(db, data.user_profiles);
  await upsertCategories(db, data.categories);
  await upsertAccounts(db, data.accounts);
  await upsertBudgets(db, data.budgets);
  await upsertTransactions(db, data.transactions);
  await upsertChatMessages(db, data.chat_messages);

  for (const table of SYNC_TABLES) {
    await setLastPullAt(db, table, now);
  }
}

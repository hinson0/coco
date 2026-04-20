import { apiFetch } from "@/lib/api";
import type * as SQLite from "expo-sqlite";
import { getWatermark, setLastPullAt, type SyncTable } from "./watermarks";

type Row = Record<string, SQLite.SQLiteBindValue>;

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
  // categories 需要包含默认分类（user_id IS NULL），因为 budgets/transactions 会引用它们
  if (table === "categories") {
    if (lastPushAt === null) {
      return db.getAllAsync<Row>(
        `SELECT * FROM categories WHERE user_id = ? OR user_id IS NULL`,
        userId,
      );
    }
    return db.getAllAsync<Row>(
      `SELECT * FROM categories WHERE (user_id = ? OR user_id IS NULL) AND updated_at > ?`,
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

// 历史 OCR bug 在本地 SQLite 留下 occurred_at=""/null 的 transaction 行，后端 Pydantic
// 会把这种行整批 422 拒掉。push 前用 created_at 兜底，保证 payload 合法。
function sanitizeTransactions(rows: readonly Row[]): readonly Row[] {
  return rows.map((row) =>
    row.occurred_at ? row : { ...row, occurred_at: row.created_at },
  );
}

/** 正在执行 push 的互斥锁，防止定时 push 和即时 push 并发 */
let pushInFlight: Promise<void> | null = null;

/**
 * 推送本地变更到后端。
 * @param full 全量推送（忽略水位线，重传所有数据）。用于修复历史同步失败。
 */
export async function push(
  db: SQLite.SQLiteDatabase,
  userId: string,
  { full = false } = {},
): Promise<void> {
  // 互斥：如果已有 push 在执行，等它结束再开始新的
  if (pushInFlight) {
    await pushInFlight;
  }

  let resolve: () => void;
  pushInFlight = new Promise<void>((r) => {
    resolve = r;
  });

  try {
    await pushInternal(db, userId, full);
  } finally {
    pushInFlight = null;
    resolve!();
  }
}

async function pushInternal(
  db: SQLite.SQLiteDatabase,
  userId: string,
  full = false,
): Promise<void> {
  const now = new Date().toISOString();
  const payload: Record<string, readonly Row[]> = {};
  let totalRows = 0;

  for (const table of SYNC_TABLES) {
    const lastPushAt = full
      ? null
      : (await getWatermark(db, table)).last_push_at;
    const rows = await getChangedRows(db, userId, table, lastPushAt);
    payload[table] =
      table === "transactions" ? sanitizeTransactions(rows) : rows;
    totalRows += rows.length;
    if (rows.length > 0) {
      console.info(`[Sync]   ${table}: ${rows.length} 条`);
    }
  }

  if (totalRows === 0) return; // 没有变更，跳过网络请求

  console.info(`[Sync] push: ${totalRows} 条记录待上传`);

  await apiFetch<{ ok: boolean }>("/sync/push", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  // 水位线原子更新：用事务保证全部成功或全部不更新
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const table of SYNC_TABLES) {
      await txn.runAsync(
        `INSERT INTO sync_watermarks (table_name, last_push_at)
         VALUES (?, ?)
         ON CONFLICT(table_name) DO UPDATE SET last_push_at = excluded.last_push_at`,
        table,
        now,
      );
    }
  });

  console.info(`[Sync] push 完成，水位线更新至 ${now}`);
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
  _userId: string,
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

/** 查询所有表中尚未 push 的记录总数 */
export async function getPendingCount(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<number> {
  let total = 0;
  for (const table of SYNC_TABLES) {
    const { last_push_at } = await getWatermark(db, table);
    const rows = await getChangedRows(db, userId, table, last_push_at);
    total += rows.length;
  }
  return total;
}

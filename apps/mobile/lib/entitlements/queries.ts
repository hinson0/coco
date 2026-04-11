// apps/mobile/lib/entitlements/queries.ts
import type * as SQLite from 'expo-sqlite';
import type { FeatureKey } from './rewards';

export interface EntitlementRow {
  feature: FeatureKey;
  balance: number;
  total_earned: number;
  last_decay_at: string | null;
}

/** 查询单个功能的权益余额，不存在则返回 balance=0 */
export async function getEntitlement(
  db: SQLite.SQLiteDatabase,
  feature: FeatureKey,
): Promise<EntitlementRow> {
  const row = await db.getFirstAsync<EntitlementRow>(
    'SELECT feature, balance, total_earned, last_decay_at FROM entitlements WHERE feature = ?',
    feature,
  );
  return row ?? { feature, balance: 0, total_earned: 0, last_decay_at: null };
}

/** 查询所有功能的权益余额 */
export async function getAllEntitlements(
  db: SQLite.SQLiteDatabase,
): Promise<EntitlementRow[]> {
  const rows = await db.getAllAsync<EntitlementRow>(
    'SELECT feature, balance, total_earned, last_decay_at FROM entitlements ORDER BY feature',
  );
  return rows;
}

/** 增加权益余额（upsert） */
export async function addEntitlement(
  db: SQLite.SQLiteDatabase,
  feature: FeatureKey,
  amount: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO entitlements (feature, balance, total_earned)
     VALUES (?, ?, ?)
     ON CONFLICT(feature) DO UPDATE SET
       balance = balance + excluded.balance,
       total_earned = total_earned + excluded.total_earned`,
    feature,
    amount,
    amount,
  );
}

/** 原子扣减权益余额。余额不足返回 -1，否则返回扣减后余额。 */
export async function consumeEntitlement(
  db: SQLite.SQLiteDatabase,
  feature: FeatureKey,
): Promise<number> {
  const result = await db.runAsync(
    'UPDATE entitlements SET balance = balance - 1 WHERE feature = ? AND balance > 0',
    feature,
  );
  if (result.changes === 0) return -1;
  const row = await db.getFirstAsync<{ balance: number }>(
    'SELECT balance FROM entitlements WHERE feature = ?',
    feature,
  );
  return row?.balance ?? -1;
}

/** 批量衰减（用于 multi_account / csv_export），更新 last_decay_at */
export async function applyDecay(
  db: SQLite.SQLiteDatabase,
  feature: FeatureKey,
  decayAmount: number,
  now: string,
): Promise<void> {
  if (decayAmount <= 0) return;
  await db.runAsync(
    'UPDATE entitlements SET balance = MAX(balance - ?, 0), last_decay_at = ? WHERE feature = ?',
    decayAmount,
    now,
    feature,
  );
}

/** 记录广告观看日志 */
export async function logAdWatch(
  db: SQLite.SQLiteDatabase,
  adType: 'rewarded_video' | 'splash',
  slotId: string | null,
  durationSec: number | null,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO ad_watch_logs (watched_at, ad_type, slot_id, duration_sec) VALUES (?, ?, ?, ?)',
    new Date().toISOString(),
    adType,
    slotId,
    durationSec,
  );
}

/** 查询累计观看次数（仅激励视频，用于计算下一个奖励） */
export async function getTotalRewardedWatchCount(
  db: SQLite.SQLiteDatabase,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM ad_watch_logs WHERE ad_type = 'rewarded_video'",
  );
  return row?.count ?? 0;
}

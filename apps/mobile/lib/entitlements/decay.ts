/**
 * 计算自 lastDecay 以来经过了多少个自然日（跨 0 点的次数）。
 * 衰减量 = min(经过天数, 当前余额)。
 */
export function calculateDailyDecay(
  balance: number,
  lastDecay: string | null,
  now: string,
): number {
  if (balance <= 0 || !lastDecay) return 0;

  const lastDate = new Date(lastDecay);
  const nowDate = new Date(now);

  const lastDay = Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), lastDate.getUTCDate());
  const nowDay = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
  const daysPassed = Math.floor((nowDay - lastDay) / (24 * 60 * 60 * 1000));

  if (daysPassed <= 0) return 0;
  return Math.min(daysPassed, balance);
}

/**
 * 计算自 lastDecay 以来经过了多少个周一（ISO 周起点）。
 * 衰减量 = min(经过周数, 当前余额)。
 */
export function calculateWeeklyDecay(
  balance: number,
  lastDecay: string | null,
  now: string,
): number {
  if (balance <= 0 || !lastDecay) return 0;

  const lastDate = new Date(lastDecay);
  const nowDate = new Date(now);

  const lastMonday = getMondayUTC(lastDate);
  const nowMonday = getMondayUTC(nowDate);

  const weeksPassed = Math.floor((nowMonday - lastMonday) / (7 * 24 * 60 * 60 * 1000));

  if (weeksPassed <= 0) return 0;
  return Math.min(weeksPassed, balance);
}

/** 获取给定日期所在周的周一 0:00 UTC 时间戳 */
function getMondayUTC(date: Date): number {
  const d = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const dayOfWeek = new Date(d).getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return d - daysFromMonday * 24 * 60 * 60 * 1000;
}

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

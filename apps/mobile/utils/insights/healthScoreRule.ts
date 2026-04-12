// apps/mobile/utils/insights/healthScoreRule.ts
import type { InsightContext, InsightItem } from "./types";

function calcSavingsRate(
  transactions: readonly { type: string; amount: number }[],
): number {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.type === "income") income += Number(tx.amount);
    else if (tx.type === "expense") expense += Number(tx.amount);
  }
  if (income <= 0) return 0;
  return Math.max(0, (income - expense) / income);
}

function savingsRateScore(rate: number): number {
  return Math.min(100, Math.max(0, (rate / 0.3) * 100));
}

function paceScore(ctx: InsightContext): number {
  const expenses = ctx.currentMonth.filter((tx) => tx.type === "expense");
  if (expenses.length === 0) return 100;

  const totalExpense = expenses.reduce((s, tx) => s + Number(tx.amount), 0);
  const dailyAvg = totalExpense / ctx.daysElapsed;
  const estimatedTotal = dailyAvg * ctx.daysInMonth;
  const spendProgress = estimatedTotal > 0 ? totalExpense / estimatedTotal : 0;
  const timeProgress = ctx.daysElapsed / ctx.daysInMonth;

  const deviation = Math.abs(spendProgress - timeProgress);
  return Math.min(100, Math.max(0, (1 - deviation / 0.3) * 100));
}

function anomalyCount(
  transactions: readonly { type: string; amount: number }[],
): number {
  const expenses = transactions
    .filter((tx) => tx.type === "expense")
    .map((tx) => Number(tx.amount));
  if (expenses.length < 3) return 0;

  const sorted = [...expenses].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const mean = expenses.reduce((s, v) => s + v, 0) / expenses.length;
  const variance =
    expenses.reduce((s, v) => s + (v - mean) ** 2, 0) / expenses.length;
  const stdDev = Math.sqrt(variance);

  const threshold = median + 2 * stdDev;
  return expenses.filter((a) => a > threshold && a >= 500).length;
}

function getLevel(score: number): string {
  if (score <= 40) return "差";
  if (score <= 60) return "一般";
  if (score <= 80) return "良好";
  return "优秀";
}

export function healthScoreRule(ctx: InsightContext): InsightItem {
  const savingsRate = calcSavingsRate(ctx.currentMonth);
  const srScore = savingsRateScore(savingsRate);
  const pScore = paceScore(ctx);
  const aCount = anomalyCount(ctx.currentMonth);
  const aScore = Math.max(0, 100 - aCount * 25);

  const score = Math.round(srScore * 0.6 + pScore * 0.2 + aScore * 0.2);
  const level = getLevel(score);

  const prevSavingsRate =
    ctx.previousMonth.length > 0
      ? calcSavingsRate(ctx.previousMonth)
      : undefined;

  const ratePercent = Math.round(savingsRate * 100);
  let desc = `本月结余率 ${ratePercent}%`;
  if (prevSavingsRate !== undefined) {
    const diff = Math.round((savingsRate - prevSavingsRate) * 100);
    if (diff > 0) desc += `，较上月提升 ${diff} 个百分点`;
    else if (diff < 0) desc += `，较上月下降 ${Math.abs(diff)} 个百分点`;
    else desc += `，与上月持平`;
  }

  const emoji =
    score > 80 ? "🌟" : score > 60 ? "👍" : score > 40 ? "📊" : "⚠️";

  const badge =
    prevSavingsRate !== undefined
      ? {
          text: `${savingsRate >= prevSavingsRate ? "↑" : "↓"} ${Math.abs(Math.round((savingsRate - prevSavingsRate) * 100))}%`,
          direction:
            savingsRate >= prevSavingsRate
              ? ("up" as const)
              : ("down" as const),
        }
      : undefined;

  return {
    type: "health",
    priority: 1,
    emoji,
    title: `收支健康度 · ${level}`,
    desc,
    badge,
    meta: { score, level, savingsRate, prevSavingsRate },
  };
}

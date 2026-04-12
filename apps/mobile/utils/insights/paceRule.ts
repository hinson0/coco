import type { InsightContext, InsightItem } from "./types";

const MIN_DAYS = 5;
const MIN_DEVIATION = 0.15;

export function paceRule(ctx: InsightContext): InsightItem | null {
  if (ctx.daysElapsed < MIN_DAYS) return null;

  const totalExpense = ctx.currentMonth
    .filter((tx) => tx.type === "expense")
    .reduce((s, tx) => s + Number(tx.amount), 0);

  if (totalExpense === 0) return null;

  const totalIncome = ctx.currentMonth
    .filter((tx) => tx.type === "income")
    .reduce((s, tx) => s + Number(tx.amount), 0);

  if (totalIncome <= 0) return null;

  const timeProgress = ctx.daysElapsed / ctx.daysInMonth;
  const spendProgress = totalExpense / totalIncome;
  const deviation = spendProgress - timeProgress;

  if (deviation < MIN_DEVIATION) return null;

  const spendPct = Math.round(spendProgress * 100);
  const timePct = Math.round(timeProgress * 100);

  return {
    type: "pace",
    priority: 4,
    emoji: "⏱️",
    title: "消费节奏偏快",
    desc: `月过 ${timePct}% 已消费收入的 ${spendPct}%，注意控制节奏`,
    badge: { text: "注意", direction: "neutral" },
    meta: {
      timeProgress,
      spendProgress,
      estimatedMonthTotal: (totalExpense / ctx.daysElapsed) * ctx.daysInMonth,
    },
  };
}

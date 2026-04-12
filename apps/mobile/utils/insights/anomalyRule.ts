import type { InsightContext, InsightItem } from "./types";

export function anomalyRule(ctx: InsightContext): InsightItem | null {
  const expenses = ctx.currentMonth
    .filter((tx) => tx.type === "expense")
    .map((tx) => ({ ...tx, numAmount: Number(tx.amount) }));

  if (expenses.length < 3) return null;

  const amounts = expenses.map((tx) => tx.numAmount);
  const sorted = [...amounts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
  const variance =
    amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length;
  const stdDev = Math.sqrt(variance);

  const threshold = median + 2 * stdDev;

  const anomalies = expenses
    .filter((tx) => tx.numAmount > threshold && tx.numAmount >= 500)
    .sort((a, b) => b.numAmount - a.numAmount);

  if (anomalies.length === 0) return null;

  const top = anomalies[0];
  const cat = ctx.categories.find((c) => c.id === top.category_id);

  return {
    type: "anomaly",
    priority: 3,
    emoji: "⚡",
    title: "大额支出提醒",
    desc: `本月有一笔 ¥${Math.round(top.numAmount).toLocaleString()} 的消费远超日常水平`,
    badge: { text: "异常", direction: "neutral" },
    navigation: {
      route: "/category-detail",
      params: { categoryId: top.category_id },
    },
    meta: {
      transactionId: top.id,
      amount: top.numAmount,
      categoryEmoji: cat?.icon ?? "📦",
      categoryName: cat?.name ?? "其他",
      date: top.occurred_at.slice(0, 10),
    },
  };
}

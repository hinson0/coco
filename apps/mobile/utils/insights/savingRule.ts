import type {
  InsightContext,
  InsightItem,
  SavingSuggestion,
  CategoryChangeMeta,
  FrequencyMeta,
} from "./types";

const MIN_SAVING = 50;
const REDUCE_RATIO = 0.25;

export function savingRule(
  ctx: InsightContext,
  priorResults: InsightItem[],
): InsightItem | null {
  const suggestions: SavingSuggestion[] = [];

  const upChanges = priorResults.filter(
    (r) =>
      r.type === "category-change" && r.badge?.direction === "up" && r.meta,
  );
  for (const change of upChanges) {
    const meta = change.meta as CategoryChangeMeta;
    const txCount = ctx.currentMonth.filter(
      (tx) => tx.type === "expense" && tx.category_id === meta.categoryId,
    ).length;
    if (txCount === 0) continue;
    const avgPerTx = meta.currentAmount / txCount;
    const reduceCount = Math.max(1, Math.round(txCount * REDUCE_RATIO));
    suggestions.push({
      category: change.emoji,
      emoji: change.emoji,
      reduceCount,
      saveAmount: Math.round(reduceCount * avgPerTx),
    });
  }

  const freqs = priorResults.filter((r) => r.type === "frequency" && r.meta);
  for (const freq of freqs) {
    const meta = freq.meta as FrequencyMeta;
    const avgPerTx = meta.totalAmount / meta.count;
    const reduceCount = Math.max(1, Math.round(meta.count * REDUCE_RATIO));
    if (suggestions.some((s) => s.category === freq.emoji)) continue;
    suggestions.push({
      category: meta.categoryName,
      emoji: meta.categoryEmoji,
      reduceCount,
      saveAmount: Math.round(reduceCount * avgPerTx),
    });
  }

  if (suggestions.length === 0) return null;

  const totalSaving = suggestions.reduce((s, sg) => s + sg.saveAmount, 0);
  if (totalSaving < MIN_SAVING) return null;

  const parts = suggestions
    .map((s) => `减少 ${s.reduceCount} 次${s.category}`)
    .join(" + ");

  return {
    type: "saving",
    priority: 7,
    emoji: "💡",
    title: "节省建议",
    desc: `${parts}，每月可节省：`,
    meta: { suggestions, totalSaving },
  };
}

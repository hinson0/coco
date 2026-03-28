import type { InsightContext, InsightItem } from './types';

const MIN_FREQUENCY = 8;

export function frequencyRule(ctx: InsightContext): InsightItem | null {
  const catCount = new Map<string, { count: number; total: number }>();

  for (const tx of ctx.currentMonth) {
    if (tx.type !== 'expense') continue;
    const existing = catCount.get(tx.category_id);
    if (existing) {
      existing.count++;
      existing.total += Number(tx.amount);
    } else {
      catCount.set(tx.category_id, { count: 1, total: Number(tx.amount) });
    }
  }

  let maxEntry: { categoryId: string; count: number; total: number } | null = null;
  for (const [categoryId, data] of catCount) {
    if (data.count >= MIN_FREQUENCY && (!maxEntry || data.count > maxEntry.count)) {
      maxEntry = { categoryId, ...data };
    }
  }

  if (!maxEntry) return null;

  const cat = ctx.categories.find(c => c.id === maxEntry!.categoryId);
  const emoji = cat?.icon ?? '📦';
  const name = cat?.name ?? '其他';

  return {
    type: 'frequency',
    priority: 6,
    emoji,
    title: '高频消费提醒',
    desc: `本月${name}消费 ${maxEntry.count} 次，累计 ¥${Math.round(maxEntry.total)}`,
    badge: { text: `${maxEntry.count} 次`, direction: 'neutral' },
    meta: {
      categoryId: maxEntry.categoryId,
      categoryEmoji: emoji,
      categoryName: name,
      count: maxEntry.count,
      totalAmount: maxEntry.total,
    },
  };
}

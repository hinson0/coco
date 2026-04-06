import type { InsightContext, InsightItem } from './types';

interface CategoryAmount {
  categoryId: string;
  emoji: string;
  name: string;
  amount: number;
}

function sumByCategory(
  transactions: readonly { type: string; amount: number; category_id: string }[],
  categories: readonly { id: string; name: string; icon: string }[],
): CategoryAmount[] {
  const catMap = new Map(categories.map(c => [c.id, c]));
  const map = new Map<string, CategoryAmount>();

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const cat = catMap.get(tx.category_id);
    const key = tx.category_id;
    const existing = map.get(key);
    if (existing) {
      existing.amount += Number(tx.amount);
    } else {
      map.set(key, {
        categoryId: key,
        emoji: cat?.icon ?? '📦',
        name: cat?.name ?? '其他',
        amount: Number(tx.amount),
      });
    }
  }
  return [...map.values()];
}

const MIN_CHANGE_PERCENT = 15;
const MIN_CHANGE_AMOUNT = 50;

export function categoryChangeRule(ctx: InsightContext): InsightItem[] | null {
  if (ctx.previousMonth.length === 0) return null;

  const current = sumByCategory(ctx.currentMonth, ctx.categories);
  const previous = sumByCategory(ctx.previousMonth, ctx.categories);
  const prevMap = new Map(previous.map(c => [c.categoryId, c.amount]));

  const changes: { cat: CategoryAmount; prevAmount: number; changePercent: number }[] = [];

  for (const cat of current) {
    const prevAmount = prevMap.get(cat.categoryId) ?? 0;
    if (prevAmount === 0 && cat.amount === 0) continue;
    const changePercent = prevAmount === 0 ? 100 : ((cat.amount - prevAmount) / prevAmount) * 100;
    const absDiff = Math.abs(cat.amount - prevAmount);

    if (Math.abs(changePercent) >= MIN_CHANGE_PERCENT && absDiff >= MIN_CHANGE_AMOUNT) {
      changes.push({ cat, prevAmount, changePercent });
    }
  }

  if (changes.length === 0) return null;

  changes.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  const results: InsightItem[] = [];

  const up = changes.find(c => c.changePercent > 0);
  if (up) {
    const pct = Math.round(up.changePercent);
    results.push({
      type: 'category-change',
      priority: 2,
      emoji: up.cat.emoji,
      title: `${up.cat.name}支出偏高`,
      desc: `较上月增长 ¥${Math.round(up.cat.amount - up.prevAmount)}，注意控制`,
      badge: { text: `↑ ${pct}%`, direction: 'up' as const },
      navigation: { route: '/category-detail', params: { categoryId: up.cat.categoryId } },
      meta: { categoryId: up.cat.categoryId, currentAmount: up.cat.amount, previousAmount: up.prevAmount, changePercent: pct },
    });
  }

  const down = changes.find(c => c.changePercent < 0);
  if (down) {
    const pct = Math.abs(Math.round(down.changePercent));
    results.push({
      type: 'category-change',
      priority: 5,
      emoji: down.cat.emoji,
      title: `${down.cat.name}支出正常`,
      desc: `较上月减少 ${pct}%，保持得不错`,
      badge: { text: `↓ ${pct}%`, direction: 'down' as const },
      navigation: { route: '/category-detail', params: { categoryId: down.cat.categoryId } },
      meta: { categoryId: down.cat.categoryId, currentAmount: down.cat.amount, previousAmount: down.prevAmount, changePercent: -pct },
    });
  }

  return results.length > 0 ? results : null;
}

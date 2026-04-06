import { savingRule } from '../savingRule';
import type { InsightContext, InsightItem } from '../types';

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    currentMonth: [],
    previousMonth: [],
    categories: [],
    year: 2026, month: 2, daysInMonth: 31, daysElapsed: 31,
    ...overrides,
  };
}

describe('savingRule', () => {
  it('无前序结果返回 null', () => {
    expect(savingRule(makeCtx(), [])).toBeNull();
  });

  it('前序结果中无环比增长或高频消费返回 null', () => {
    const prior: InsightItem[] = [
      { type: 'health', priority: 1, emoji: '👍', title: 't', desc: 'd', meta: { score: 80 } },
    ];
    expect(savingRule(makeCtx(), prior)).toBeNull();
  });

  it('有环比增长时生成节省建议', () => {
    const prior: InsightItem[] = [
      {
        type: 'category-change', priority: 2, emoji: '🍜', title: '餐饮支出偏高', desc: 'd',
        badge: { text: '↑ 20%', direction: 'up' },
        meta: { categoryId: 'c1', currentAmount: 2400, previousAmount: 2000, changePercent: 20 },
      },
    ];
    const ctx = makeCtx({
      currentMonth: Array.from({ length: 12 }, () => ({
        type: 'expense' as const, amount: 200, id: '1', user_id: '', category_id: 'c1', note: '', occurred_at: '2026-03-10', source: 'manual' as const, raw_input: null, receipt_url: null, ai_confidence: null, created_at: '', deleted_at: null, account_id: null,
      })),
    });
    const result = savingRule(ctx, prior);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('saving');
    expect(result!.priority).toBe(7);
    expect(result!.meta!.totalSaving).toBeGreaterThanOrEqual(50);
  });

  it('有高频消费时生成节省建议', () => {
    const prior: InsightItem[] = [
      {
        type: 'frequency', priority: 6, emoji: '🧋', title: '高频消费提醒', desc: 'd',
        meta: { categoryId: 'c1', categoryEmoji: '🧋', categoryName: '饮品', count: 12, totalAmount: 360 },
      },
    ];
    const result = savingRule(makeCtx(), prior);
    expect(result).not.toBeNull();
    expect(result!.meta!.totalSaving).toBeGreaterThanOrEqual(50);
  });

  it('预估节省 < ¥50 不触发', () => {
    const prior: InsightItem[] = [
      {
        type: 'frequency', priority: 6, emoji: '🧋', title: '高频消费提醒', desc: 'd',
        meta: { categoryId: 'c1', categoryEmoji: '🧋', categoryName: '饮品', count: 8, totalAmount: 80 },
      },
    ];
    const result = savingRule(makeCtx(), prior);
    expect(result).toBeNull();
  });
});

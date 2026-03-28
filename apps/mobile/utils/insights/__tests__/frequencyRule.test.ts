import { frequencyRule } from '../frequencyRule';
import type { InsightContext } from '../types';

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    currentMonth: [],
    previousMonth: [],
    categories: [
      { id: 'c1', user_id: null, name: '饮品', icon: '🧋', type: 'expense', is_default: true, deleted_at: null },
      { id: 'c2', user_id: null, name: '餐饮', icon: '🍜', type: 'expense', is_default: true, deleted_at: null },
    ],
    year: 2026, month: 2, daysInMonth: 31, daysElapsed: 31,
    ...overrides,
  };
}

function makeTx(categoryId: string, amount: number) {
  return { type: 'expense' as const, amount, id: `t-${Math.random()}`, user_id: '', category_id: categoryId, note: '', occurred_at: '2026-03-10', source: 'manual' as const, raw_input: null, receipt_url: null, ai_confidence: null, created_at: '', deleted_at: null, account_id: null };
}

describe('frequencyRule', () => {
  it('消费次数 < 8 不触发', () => {
    const txs = Array.from({ length: 7 }, () => makeTx('c1', 30));
    expect(frequencyRule(makeCtx({ currentMonth: txs }))).toBeNull();
  });

  it('消费次数 ≥ 8 触发', () => {
    const txs = Array.from({ length: 10 }, () => makeTx('c1', 30));
    const result = frequencyRule(makeCtx({ currentMonth: txs }));
    expect(result).not.toBeNull();
    expect(result!.type).toBe('frequency');
    expect(result!.priority).toBe(6);
    expect(result!.meta!.count).toBe(10);
    expect(result!.meta!.totalAmount).toBe(300);
  });

  it('取频次最高的分类', () => {
    const txs = [
      ...Array.from({ length: 12 }, () => makeTx('c1', 30)),
      ...Array.from({ length: 9 }, () => makeTx('c2', 50)),
    ];
    const result = frequencyRule(makeCtx({ currentMonth: txs }));
    expect(result!.meta!.categoryId).toBe('c1');
    expect(result!.meta!.count).toBe(12);
  });

  it('只统计支出', () => {
    const txs = Array.from({ length: 10 }, () => ({
      ...makeTx('c1', 30),
      type: 'income' as const,
    }));
    expect(frequencyRule(makeCtx({ currentMonth: txs }))).toBeNull();
  });
});

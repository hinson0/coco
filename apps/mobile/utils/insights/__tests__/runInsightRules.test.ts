import { runInsightRules } from '../runInsightRules';
import type { InsightContext } from '../types';

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    currentMonth: [],
    previousMonth: [],
    categories: [],
    year: 2026, month: 2, daysInMonth: 31, daysElapsed: 15,
    ...overrides,
  };
}

function makeTx(type: 'income' | 'expense', amount: number, categoryId = 'c1') {
  return { type, amount, id: `t-${Math.random()}`, user_id: '', category_id: categoryId, note: '', occurred_at: '2026-03-10', source: 'manual' as const, raw_input: null, receipt_url: null, ai_confidence: null, created_at: '', deleted_at: null, account_id: null };
}

describe('runInsightRules', () => {
  it('空数据时至少返回健康度卡片', () => {
    const results = runInsightRules(makeCtx());
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].type).toBe('health');
  });

  it('结果按 priority 升序排列', () => {
    const ctx = makeCtx({
      categories: [
        { id: 'c1', user_id: null, name: '餐饮', icon: '🍜', type: 'expense', is_default: true, deleted_at: null },
      ],
      currentMonth: [
        makeTx('income', 10000),
        ...Array.from({ length: 10 }, () => makeTx('expense', 100)),
        makeTx('expense', 3200),
      ],
      previousMonth: [makeTx('expense', 500)],
    });
    const results = runInsightRules(ctx);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].priority).toBeGreaterThanOrEqual(results[i - 1].priority);
    }
  });

  it('健康度始终是第一个', () => {
    const ctx = makeCtx({
      categories: [
        { id: 'c1', user_id: null, name: '餐饮', icon: '🍜', type: 'expense', is_default: true, deleted_at: null },
      ],
      currentMonth: [
        makeTx('income', 10000),
        makeTx('expense', 8000),
      ],
      previousMonth: [makeTx('expense', 4000)],
      daysElapsed: 15,
    });
    const results = runInsightRules(ctx);
    expect(results[0].type).toBe('health');
  });

  it('savingRule 在最后（如果存在）', () => {
    const ctx = makeCtx({
      categories: [
        { id: 'c1', user_id: null, name: '饮品', icon: '🧋', type: 'expense', is_default: true, deleted_at: null },
      ],
      currentMonth: [
        makeTx('income', 10000),
        ...Array.from({ length: 12 }, () => makeTx('expense', 100)),
      ],
    });
    const results = runInsightRules(ctx);
    const savingIdx = results.findIndex(r => r.type === 'saving');
    if (savingIdx !== -1) {
      expect(savingIdx).toBe(results.length - 1);
    }
  });
});

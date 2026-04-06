import {
  formatMonthLabelPadded,
  buildDateRangeLabel,
  computeDaysElapsed,
  buildDailyData,
  buildCategoryStats,
  buildTransactionRank,
  getDimensionValue,
} from '../statsUtils';

// ── formatMonthLabelPadded ────────────────────────────
describe('formatMonthLabelPadded', () => {
  it('pads single-digit month with zero', () => {
    expect(formatMonthLabelPadded(new Date(2026, 2, 15))).toBe('2026年03月');
  });
  it('handles double-digit month', () => {
    expect(formatMonthLabelPadded(new Date(2026, 11, 1))).toBe('2026年12月');
  });
});

// ── buildDateRangeLabel ───────────────────────────────
describe('buildDateRangeLabel', () => {
  it('returns correct range for March 2026', () => {
    expect(buildDateRangeLabel(new Date(2026, 2, 15))).toBe(
      '2026年03月01日—2026年03月31日',
    );
  });
  it('handles February in a leap year', () => {
    expect(buildDateRangeLabel(new Date(2024, 1, 10))).toBe(
      '2024年02月01日—2024年02月29日',
    );
  });
});

// ── computeDaysElapsed ────────────────────────────────
describe('computeDaysElapsed', () => {
  it('returns total days for a past month (January 2026)', () => {
    expect(computeDaysElapsed(new Date(2026, 0, 1))).toBe(31);
  });
  it('returns total days for another past month (February 2024 leap year)', () => {
    expect(computeDaysElapsed(new Date(2024, 1, 1))).toBe(29);
  });
  it('returns at least 1 (never zero)', () => {
    expect(computeDaysElapsed(new Date(2026, 2, 1))).toBeGreaterThanOrEqual(1);
  });
  it('returns 1 for a future month', () => {
    expect(computeDaysElapsed(new Date(2099, 0, 1))).toBe(1);
  });
});

// ── buildDailyData ────────────────────────────────────
describe('buildDailyData', () => {
  const txs = [
    { occurred_at: '2026-03-01', type: 'expense', amount: '100' },
    { occurred_at: '2026-03-01', type: 'income',  amount: '200' },
    { occurred_at: '2026-03-15', type: 'expense', amount: '50'  },
  ] as any[];

  it('returns one entry per day in the month', () => {
    const result = buildDailyData(txs, new Date(2026, 2, 1));
    expect(result).toHaveLength(31);
  });
  it('aggregates expense and income for a day', () => {
    const result = buildDailyData(txs, new Date(2026, 2, 1));
    expect(result[0]).toEqual({ date: '2026-03-01', expense: 100, income: 200 });
  });
  it('defaults to zero for days with no transactions', () => {
    const result = buildDailyData(txs, new Date(2026, 2, 1));
    expect(result[1]).toEqual({ date: '2026-03-02', expense: 0, income: 0 });
  });
  it('handles amount of zero without error', () => {
    const zeroTx = [{ occurred_at: '2026-03-01', type: 'expense', amount: '0' }] as any[];
    const result = buildDailyData(zeroTx, new Date(2026, 2, 1));
    expect(result[0].expense).toBe(0);
  });
});

// ── buildCategoryStats ────────────────────────────────
describe('buildCategoryStats', () => {
  const COLORS = ['#e8856c', '#7ba68a', '#d4a853'];
  const catMap = {
    c1: { id: 'c1', name: '餐饮', icon: '🍜' },
    c2: { id: 'c2', name: '交通', icon: '🚌' },
  } as any;
  const txs = [
    { type: 'expense', category_id: 'c1', amount: '300' },
    { type: 'expense', category_id: 'c1', amount: '200' },
    { type: 'expense', category_id: 'c2', amount: '100' },
  ] as any[];

  it('sorts by amount descending', () => {
    const result = buildCategoryStats(txs, 'expense', catMap, COLORS);
    expect(result[0].name).toBe('餐饮');
    expect(result[1].name).toBe('交通');
  });
  it('computes percent correctly', () => {
    const result = buildCategoryStats(txs, 'expense', catMap, COLORS);
    expect(result[0].percent).toBe(83);
  });
  it('includes count of transactions', () => {
    const result = buildCategoryStats(txs, 'expense', catMap, COLORS);
    expect(result[0].count).toBe(2);
  });
  it('assigns color by index', () => {
    const result = buildCategoryStats(txs, 'expense', catMap, COLORS);
    expect(result[0].color).toBe(COLORS[0]);
  });
});

// ── buildTransactionRank ──────────────────────────────
describe('buildTransactionRank', () => {
  const catMap = {
    c1: { id: 'c1', name: '餐饮', icon: '🍜' },
  } as any;
  const txs = [
    { id: 't1', type: 'expense', category_id: 'c1', amount: '50',  occurred_at: '2026-03-05', note: '' },
    { id: 't2', type: 'expense', category_id: 'c1', amount: '500', occurred_at: '2026-03-01', note: '外卖' },
  ] as any[];

  it('sorts by amount descending (absolute value)', () => {
    const result = buildTransactionRank(txs, 'expense', catMap);
    expect(result[0].id).toBe('t2');
  });
  it('includes note when present', () => {
    const result = buildTransactionRank(txs, 'expense', catMap);
    expect(result[0].note).toBe('外卖');
  });
  it('omits note when empty', () => {
    const result = buildTransactionRank(txs, 'expense', catMap);
    expect(result[1].note).toBeUndefined();
  });
});

// ── getDimensionValue ─────────────────────────────────
describe('getDimensionValue', () => {
  const day = { date: '2026-03-01', expense: 100, income: 200 };
  it('returns expense', () => expect(getDimensionValue(day, 'expense')).toBe(100));
  it('returns income',  () => expect(getDimensionValue(day, 'income')).toBe(200));
  it('returns balance (income - expense)', () => expect(getDimensionValue(day, 'balance')).toBe(100));
  it('returns negative balance', () => {
    expect(getDimensionValue({ date: '', expense: 300, income: 100 }, 'balance')).toBe(-200);
  });
});

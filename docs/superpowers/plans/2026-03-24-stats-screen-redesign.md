# Stats Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按参考设计（黄色小鸭风格）重构统计页面，新增收支总览、每日趋势（双切换）、分类排行、明细排行四张卡片，替换现有简版布局。

**Architecture:** 将数据计算逻辑提取到 `statsUtils.ts`（可单元测试），新建 5 个 UI 组件，重写 `stats.tsx` 的 JSX 层，删除 4 个旧组件。测试覆盖纯函数层（Node + ts-jest），UI 组件不做渲染测试（无 RNTL）。

**Tech Stack:** React Native 0.83, Expo 55, TypeScript, react-native-gifted-charts v1.4.x, Jest 29 + ts-jest

**Spec:** `docs/superpowers/specs/2026-03-24-stats-screen-redesign.md`

---

## File Map

| 操作 | 文件 |
|------|------|
| 新建 | `apps/mobile/utils/statsUtils.ts` |
| 新建 | `apps/mobile/utils/__tests__/statsUtils.test.ts` |
| 新建 | `apps/mobile/components/stats/AccountSelectorBar.tsx` |
| 新建 | `apps/mobile/components/stats/SummaryOverviewCard.tsx` |
| 新建 | `apps/mobile/components/stats/DailyTrendCard.tsx` |
| 新建 | `apps/mobile/components/stats/CategoryRankCard.tsx` |
| 新建 | `apps/mobile/components/stats/TransactionRankCard.tsx` |
| 修改 | `apps/mobile/app/(tabs)/stats.tsx` |
| 删除 | `apps/mobile/components/stats/PeriodTabs.tsx` |
| 删除 | `apps/mobile/components/stats/MonthSelector.tsx` |
| 删除 | `apps/mobile/components/stats/BarChartCard.tsx` |
| 删除 | `apps/mobile/components/stats/DonutChartCard.tsx` |
| 保留 | `apps/mobile/components/stats/TrendInsightRow.tsx`（不改） |

---

## Task 1: 提取纯数据函数到 statsUtils.ts（TDD）

**Files:**
- Create: `apps/mobile/utils/statsUtils.ts`
- Create: `apps/mobile/utils/__tests__/statsUtils.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/mobile/utils/__tests__/statsUtils.test.ts`：

```ts
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
    // January is a past month → return full month days = 31
    expect(computeDaysElapsed(new Date(2026, 0, 1))).toBe(31);
  });
  it('returns total days for another past month (February 2024 leap year)', () => {
    expect(computeDaysElapsed(new Date(2024, 1, 1))).toBe(29);
  });
  it('returns at least 1 (never zero)', () => {
    // any valid month should return >= 1
    expect(computeDaysElapsed(new Date(2026, 2, 1))).toBeGreaterThanOrEqual(1);
  });
  it('returns 1 for a future month', () => {
    // year 2099 is definitely in the future → clamp to 1
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
    expect(result[0].percent).toBe(83); // 500/600 ≈ 83%
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
```

- [ ] **Step 2: 运行测试，确认全部失败**

```bash
cd apps/mobile && npx jest utils/__tests__/statsUtils.test.ts --no-coverage
```

期望：`FAIL` - "Cannot find module '../statsUtils'"

- [ ] **Step 3: 实现 statsUtils.ts**

创建 `apps/mobile/utils/statsUtils.ts`：

```ts
import type { Transaction } from '@coco/shared';

// 不从 theme 导入（避免 Node 测试环境解析 RN 模块链），直接定义颜色常量
const OTHER_CATEGORY_COLOR = '#e4d8c8'; // equals colors.creamDeeper

export interface DailyDataPoint {
  date: string;   // "YYYY-MM-DD"
  expense: number;
  income: number;
}

export interface CategoryStat {
  emoji: string;
  name: string;
  amount: number;
  count: number;
  percent: number;
  color: string;
}

export interface RankedTransaction {
  id: string;
  categoryEmoji: string;
  categoryName: string;
  amount: number;
  date: string;   // "YYYY-MM-DD"
  note?: string;
}

type Dimension = 'expense' | 'income' | 'balance';

/** "2026年03月" — 月份两位补零 */
export function formatMonthLabelPadded(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}年${mm}月`;
}

/** "2026年03月01日—2026年03月31日" */
export function buildDateRangeLabel(date: Date): string {
  const y = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, date.getMonth() + 1, 0).getDate();
  const dd = String(lastDay).padStart(2, '0');
  return `${y}年${mm}月01日—${y}年${mm}月${dd}日`;
}

/** 当月已过天数（至少 1，最多当月总天数）
 *  - 当月：返回 today.getDate()，最小为 1
 *  - 过去月份：返回该月总天数（月份已完结）
 *  - 未来月份：返回 1（防止除零）
 */
export function computeDaysElapsed(referenceDate: Date): number {
  const today = new Date();
  const refYear  = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const todayYear  = today.getFullYear();
  const todayMonth = today.getMonth();

  const daysInMonth = new Date(refYear, refMonth + 1, 0).getDate();

  if (refYear === todayYear && refMonth === todayMonth) {
    // 当月：已过天数
    return Math.max(1, today.getDate());
  }
  if (refYear < todayYear || (refYear === todayYear && refMonth < todayMonth)) {
    // 过去月份：整月已过
    return daysInMonth;
  }
  // 未来月份：防止除零，返回 1
  return 1;
}

/** 按日聚合当月每天的 expense/income */
export function buildDailyData(
  transactions: readonly Transaction[],
  currentDate: Date,
): DailyDataPoint[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const map: Record<string, DailyDataPoint> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const key = `${year}-${mm}-${dd}`;
    map[key] = { date: key, expense: 0, income: 0 };
  }

  for (const tx of transactions) {
    const key = tx.occurred_at.slice(0, 10);
    if (!map[key]) continue;
    const amount = Number(tx.amount);
    if (tx.type === 'expense') map[key].expense += amount;
    else if (tx.type === 'income') map[key].income += amount;
  }

  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

/** 按分类聚合，排序，取前 6（其余合并为"其他"）
 *  @param palette 颜色数组，按 index 分配给各分类（CATEGORY_COLORS from theme）
 */
export function buildCategoryStats(
  transactions: readonly Transaction[],
  type: 'expense' | 'income',
  categoryMap: Record<string, { id: string; name: string; icon: string }>,
  palette: readonly string[],
): CategoryStat[] {
  const map: Record<string, { emoji: string; name: string; amount: number; count: number }> = {};

  for (const tx of transactions) {
    if (tx.type !== type) continue;
    const cat = categoryMap[tx.category_id];
    const key = cat?.name ?? '其他';
    if (!map[key]) map[key] = { emoji: cat?.icon ?? '📦', name: key, amount: 0, count: 0 };
    map[key].amount += Number(tx.amount);
    map[key].count += 1;
  }

  const sorted = Object.values(map).sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((s, c) => s + c.amount, 0) || 1;

  const top6 = sorted.slice(0, 6);
  const rest = sorted.slice(6);

  const result: CategoryStat[] = top6.map((item, i) => ({
    ...item,
    percent: Math.round((item.amount / total) * 100),
    color: palette[i % palette.length],
  }));

  if (rest.length > 0) {
    const otherAmount = rest.reduce((s, c) => s + c.amount, 0);
    const otherCount  = rest.reduce((s, c) => s + c.count, 0);
    result.push({
      emoji: '📦',
      name: '其他',
      amount: otherAmount,
      count: otherCount,
      percent: Math.round((otherAmount / total) * 100),
      color: OTHER_CATEGORY_COLOR,
    });
  }

  return result;
}

/** 按金额绝对值降序排列的明细列表 */
export function buildTransactionRank(
  transactions: readonly Transaction[],
  type: 'expense' | 'income',
  categoryMap: Record<string, { id: string; name: string; icon: string }>,
): RankedTransaction[] {
  return transactions
    .filter((tx) => tx.type === type)
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .map((tx) => {
      const cat = categoryMap[tx.category_id];
      return {
        id: tx.id,
        categoryEmoji: cat?.icon ?? '📦',
        categoryName: cat?.name ?? '其他',
        amount: Number(tx.amount),
        date: tx.occurred_at.slice(0, 10),
        ...(tx.note?.trim() ? { note: tx.note.trim() } : {}),
      };
    });
}

/** 从 DailyDataPoint 取出指定维度的值 */
export function getDimensionValue(
  point: DailyDataPoint,
  dimension: Dimension,
): number {
  if (dimension === 'expense') return point.expense;
  if (dimension === 'income')  return point.income;
  return point.income - point.expense;
}
```

- [ ] **Step 4: 运行测试，确认全部通过**

```bash
cd apps/mobile && npx jest utils/__tests__/statsUtils.test.ts --no-coverage
```

期望：`PASS` — 所有 tests 绿色。

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/utils/statsUtils.ts apps/mobile/utils/__tests__/statsUtils.test.ts
git commit -m "feat(stats): add statsUtils pure data functions with tests"
```

---

## Task 2: AccountSelectorBar 组件

> **测试说明：** 项目 Jest 配置为 `testEnvironment: node`，未安装 `@testing-library/react-native`，UI 组件无法做渲染测试。Tasks 2–6 均跳过 RED 步骤，仅做实现 + commit。

**Files:**
- Create: `apps/mobile/components/stats/AccountSelectorBar.tsx`

- [ ] **Step 1: 创建组件**

```tsx
import { View, Pressable, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, shadows } from '../../constants/theme';

interface AccountSelectorBarProps {
  readonly monthLabel: string;  // 如 "2026年03月"
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

export function AccountSelectorBar({ monthLabel, onPrev, onNext }: AccountSelectorBarProps) {
  return (
    <View style={styles.container}>
      <Pressable style={styles.accountBtn}>
        <AppText size="md" weight="semibold" color={colors.text}>我的账本</AppText>
        <AppText size="sm" color={colors.textLight}> ▼</AppText>
      </Pressable>

      <View style={styles.monthNav}>
        <Pressable onPress={onPrev} style={styles.arrow}>
          <AppText size="xl" weight="bold" color={colors.text}>‹</AppText>
        </Pressable>
        <AppText size="md" weight="semibold" color={colors.text}>{monthLabel}</AppText>
        <Pressable onPress={onNext} style={styles.arrow}>
          <AppText size="xl" weight="bold" color={colors.text}>›</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  accountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    ...shadows.sm,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrow: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/stats/AccountSelectorBar.tsx
git commit -m "feat(stats): add AccountSelectorBar component"
```

---

## Task 3: SummaryOverviewCard 组件

**Files:**
- Create: `apps/mobile/components/stats/SummaryOverviewCard.tsx`

- [ ] **Step 1: 创建组件**

```tsx
import { View, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';

interface SummaryOverviewCardProps {
  readonly totalExpense: number;
  readonly totalIncome: number;
  readonly balance: number;
  readonly avgExpense: number;
  readonly avgIncome: number;
  readonly avgBalance: number;
  readonly dateRangeLabel: string;
}

function balanceColor(value: number): string {
  return value >= 0 ? colors.sage : colors.coral;
}

function fmt(value: number): string {
  return `¥${Math.abs(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

function fmtSigned(value: number): string {
  return value < 0 ? `-¥${Math.abs(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}` : fmt(value);
}

export function SummaryOverviewCard({
  totalExpense, totalIncome, balance,
  avgExpense, avgIncome, avgBalance,
  dateRangeLabel,
}: SummaryOverviewCardProps) {
  return (
    <Card radius="lg" shadow="md" padding={16}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <AppText size="lg" weight="semibold" color={colors.text}>收支总览</AppText>
        <AppText size="2xl">🐣</AppText>
      </View>

      <View style={styles.divider} />

      {/* Total row */}
      <View style={styles.row}>
        <View style={styles.col}>
          <AppText size="sm" color={colors.textLighter}>支出</AppText>
          <AppText size="xl" weight="bold" color={colors.coral}>{fmt(totalExpense)}</AppText>
        </View>
        <View style={styles.col}>
          <AppText size="sm" color={colors.textLighter}>收入</AppText>
          <AppText size="xl" weight="bold" color={colors.sage}>{fmt(totalIncome)}</AppText>
        </View>
        <View style={styles.col}>
          <AppText size="sm" color={colors.textLighter}>结余</AppText>
          <AppText size="xl" weight="bold" color={balanceColor(balance)}>{fmtSigned(balance)}</AppText>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Daily average row */}
      <View style={styles.row}>
        <View style={styles.col}>
          <AppText size="sm" color={colors.textLighter}>日均支出</AppText>
          <AppText size="md" weight="semibold" color={colors.textLight}>{fmt(avgExpense)}</AppText>
        </View>
        <View style={styles.col}>
          <AppText size="sm" color={colors.textLighter}>日均收入</AppText>
          <AppText size="md" weight="semibold" color={colors.textLight}>{fmt(avgIncome)}</AppText>
        </View>
        <View style={styles.col}>
          <AppText size="sm" color={colors.textLighter}>日均结余</AppText>
          <AppText size="md" weight="semibold" color={balanceColor(avgBalance)}>{fmtSigned(avgBalance)}</AppText>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Date range */}
      <View style={styles.dateRow}>
        <AppText size="sm" color={colors.textLighter}>月起始日: {dateRangeLabel}</AppText>
        <AppText size="sm" color={colors.textLighter}> ⓘ</AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  divider:  { height: 1, backgroundColor: colors.creamDark, marginVertical: 10 },
  row:      { flexDirection: 'row' },
  col:      { flex: 1, alignItems: 'center', gap: 4 },
  dateRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/stats/SummaryOverviewCard.tsx
git commit -m "feat(stats): add SummaryOverviewCard component"
```

---

## Task 4: DailyTrendCard 组件

**Files:**
- Create: `apps/mobile/components/stats/DailyTrendCard.tsx`

- [ ] **Step 1: 创建组件**

```tsx
import { useState, useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';
import { getDimensionValue, type DailyDataPoint } from '../../utils/statsUtils';

type Dimension = 'expense' | 'income' | 'balance';
type ChartType = 'bar' | 'line';

const DIMENSION_LABELS: Record<Dimension, string> = { expense: '支出', income: '收入', balance: '结余' };
const DIMENSION_COLORS: Record<Dimension, string> = {
  expense: colors.coral,
  income:  colors.sage,
  balance: colors.honey,
};

interface DailyTrendCardProps {
  readonly dailyData: DailyDataPoint[];
}

function DimensionTab({ active, dim, onPress }: { active: Dimension; dim: Dimension; onPress: () => void }) {
  const isActive = active === dim;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.dimTab, isActive && { backgroundColor: DIMENSION_COLORS[dim] }]}
    >
      <AppText size="sm" weight="semibold" color={isActive ? colors.white : colors.textLighter}>
        {DIMENSION_LABELS[dim]}
      </AppText>
    </Pressable>
  );
}

function ChartTypeTab({ active, type, onPress }: { active: ChartType; type: ChartType; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chartTab, active === type && styles.chartTabActive]}
    >
      <AppText size="sm" weight="semibold" color={active === type ? colors.text : colors.textLighter}>
        {type === 'bar' ? '柱状图' : '折线图'}
      </AppText>
    </Pressable>
  );
}

export function DailyTrendCard({ dailyData }: DailyTrendCardProps) {
  const [dimension, setDimension] = useState<Dimension>('expense');
  const [chartType, setChartType] = useState<ChartType>('bar');

  const values = useMemo(
    () => dailyData.map((d) => getDimensionValue(d, dimension)),
    [dailyData, dimension],
  );

  const hasNegative = values.some((v) => v < 0);
  const activeColor = DIMENSION_COLORS[dimension];

  // x-axis labels: show day 1, 6, 11, 16, 21, 26, and last day of month
  const xLabels = dailyData.map((d) => {
    const day = parseInt(d.date.slice(8), 10);
    const isLast = day === dailyData.length;
    return (day === 1 || (day - 1) % 5 === 0 || isLast) ? d.date.slice(5) : '';
  });

  const barData = values.map((v, i) => ({
    value: Math.abs(v),
    frontColor: v < 0 ? colors.coralLight : activeColor,
    label: xLabels[i],
    barWidth: 6,
    barBorderRadius: 3,
  }));

  const lineData = values.map((v, i) => ({
    value: v,
    label: xLabels[i],
    dataPointColor: activeColor,
  }));

  const axisTextStyle = { color: colors.textLighter, fontSize: 9 };

  return (
    <Card radius="lg" shadow="md" padding={16}>
      {/* Header */}
      <View style={styles.header}>
        <AppText size="lg" weight="semibold" color={colors.text}>每日趋势</AppText>
        <View style={styles.dimTabs}>
          {(['expense', 'income', 'balance'] as const).map((d) => (
            <DimensionTab key={d} active={dimension} dim={d} onPress={() => setDimension(d)} />
          ))}
        </View>
      </View>

      {/* Chart */}
      {chartType === 'bar' ? (
        <BarChart
          data={barData}
          height={160}
          noOfSections={4}
          isAnimated
          hideYAxisText
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={colors.creamDark}
          rulesColor={colors.creamDark}
          backgroundColor={colors.white}
          xAxisLabelTextStyle={axisTextStyle}
          initialSpacing={4}
          spacing={2}
          showNegativeValues={hasNegative}
          {...(hasNegative ? { negativeStepValue: Math.ceil(Math.max(...values.map(Math.abs)) / 4), yAxisOffset: 0 } : {})}
        />
      ) : (
        <LineChart
          data={lineData}
          height={160}
          noOfSections={4}
          isAnimated
          hideYAxisText
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={colors.creamDark}
          rulesColor={colors.creamDark}
          color={hasNegative ? colors.coral : activeColor}
          xAxisLabelTextStyle={axisTextStyle}
          initialSpacing={4}
          spacing={8}
        />
      )}

      {/* Chart type toggle */}
      <View style={styles.chartTypeTabs}>
        <ChartTypeTab active={chartType} type="bar"  onPress={() => setChartType('bar')} />
        <ChartTypeTab active={chartType} type="line" onPress={() => setChartType('line')} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dimTabs:      { flexDirection: 'row', gap: 4 },
  dimTab:       { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
  chartTypeTabs:{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 },
  chartTab:     { paddingVertical: 4, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.creamDark },
  chartTabActive: { backgroundColor: colors.white, shadowColor: '#3a3028', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/stats/DailyTrendCard.tsx
git commit -m "feat(stats): add DailyTrendCard with dimension and chart-type toggles"
```

---

## Task 5: CategoryRankCard 组件

**Files:**
- Create: `apps/mobile/components/stats/CategoryRankCard.tsx`

- [ ] **Step 1: 创建组件**

```tsx
import { useState, useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';
import type { CategoryStat } from '../../utils/statsUtils';

interface CategoryRankCardProps {
  readonly expenseByCategory: CategoryStat[];
  readonly incomeByCategory: CategoryStat[];
}

const MAX_BAR_WIDTH = 120;

export function CategoryRankCard({ expenseByCategory, incomeByCategory }: CategoryRankCardProps) {
  const [tab, setTab]         = useState<'expense' | 'income'>('expense');
  const [expanded, setExpanded] = useState(false);

  const data    = tab === 'expense' ? expenseByCategory : incomeByCategory;
  const maxAmt  = data[0]?.amount ?? 1;
  const top     = data[0];
  const visible = expanded ? data : data.slice(0, 3);

  const pieData = useMemo(
    () => data.map((c) => ({ value: c.percent, color: c.color })),
    [data],
  );

  return (
    <Card radius="lg" shadow="md" padding={16}>
      {/* Header */}
      <View style={styles.header}>
        <AppText size="lg" weight="semibold" color={colors.text}>分类排行榜</AppText>
        <View style={styles.tabs}>
          {(['expense', 'income'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => { setTab(t); setExpanded(false); }}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <AppText size="sm" weight="semibold" color={tab === t ? colors.white : colors.textLighter}>
                {t === 'expense' ? '支出' : '收入'}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Donut chart */}
      {data.length > 0 ? (
        <View style={styles.donutWrap}>
          <PieChart
            data={pieData}
            donut
            radius={80}
            innerRadius={52}
            centerLabelComponent={() => (
              <View style={styles.centerLabel}>
                <AppText size="sm" weight="bold" color={colors.text}>{top?.name}</AppText>
                <AppText size="sm" color={colors.textLighter}>{top?.percent}%</AppText>
              </View>
            )}
          />
        </View>
      ) : (
        <AppText size="xl" color={colors.textLighter} style={styles.empty}>暂无数据</AppText>
      )}

      {/* Rank list */}
      <View style={styles.list}>
        {visible.map((item, index) => (
          <View key={item.name} style={styles.rankRow}>
            <AppText size="sm" color={colors.textLighter} style={styles.rankNum}>{index + 1}</AppText>
            <AppText size="xl" style={styles.emoji}>{item.emoji}</AppText>
            <View style={styles.info}>
              <AppText size="md" weight="semibold" color={colors.text}>{item.name}</AppText>
              <AppText size="sm" color={colors.textLighter}>{item.count}笔</AppText>
            </View>
            <View style={styles.barWrap}>
              <View style={[styles.bar, { width: (item.amount / maxAmt) * MAX_BAR_WIDTH, backgroundColor: item.color }]} />
            </View>
            <AppText size="sm" weight="semibold" color={tab === 'expense' ? colors.coral : colors.sage}>
              {tab === 'expense' ? '-' : '+'}¥{item.amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
            </AppText>
          </View>
        ))}
      </View>

      {/* Expand toggle */}
      {data.length > 3 && (
        <Pressable onPress={() => setExpanded(!expanded)} style={styles.expandBtn}>
          <AppText size="sm" color={colors.textLighter}>{expanded ? '↑ 收起' : '↓ 查看更多'}</AppText>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tabs:      { flexDirection: 'row', backgroundColor: colors.creamDark, borderRadius: 12, padding: 2 },
  tab:       { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 10 },
  tabActive: { backgroundColor: colors.coral },
  donutWrap: { alignItems: 'center', marginBottom: 16 },
  centerLabel:{ alignItems: 'center' },
  empty:     { textAlign: 'center', marginVertical: 20 },
  list:      { gap: 10 },
  rankRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankNum:   { width: 16, textAlign: 'center' },
  emoji:     { width: 28, textAlign: 'center' },
  info:      { width: 56 },
  barWrap:   { flex: 1 },
  bar:       { height: 4, borderRadius: 2 },
  expandBtn: { alignItems: 'center', marginTop: 12, paddingVertical: 4 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/stats/CategoryRankCard.tsx
git commit -m "feat(stats): add CategoryRankCard with donut chart and inline expand"
```

---

## Task 6: TransactionRankCard 组件

**Files:**
- Create: `apps/mobile/components/stats/TransactionRankCard.tsx`

- [ ] **Step 1: 创建组件**

```tsx
import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';
import type { RankedTransaction } from '../../utils/statsUtils';

interface TransactionRankCardProps {
  readonly expenseTransactions: RankedTransaction[];
  readonly incomeTransactions: RankedTransaction[];
}

const MAX_VISIBLE = 10;

export function TransactionRankCard({ expenseTransactions, incomeTransactions }: TransactionRankCardProps) {
  const [tab, setTab]           = useState<'expense' | 'income'>('expense');
  const [expanded, setExpanded] = useState(false);

  const data    = tab === 'expense' ? expenseTransactions : incomeTransactions;
  const visible = expanded ? data.slice(0, MAX_VISIBLE) : data.slice(0, 3);

  // 用字符串切片避免 ISO 日期被解析为 UTC 导致时区偏移
  function formatDate(dateStr: string): string {
    const mm = dateStr.slice(5, 7);
    const dd = dateStr.slice(8, 10);
    return `${mm}月${dd}日`;
  }

  return (
    <Card radius="lg" shadow="md" padding={16}>
      {/* Header */}
      <View style={styles.header}>
        <AppText size="lg" weight="semibold" color={colors.text}>明细排行榜</AppText>
        <View style={styles.tabs}>
          {(['expense', 'income'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => { setTab(t); setExpanded(false); }}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <AppText size="sm" weight="semibold" color={tab === t ? colors.white : colors.textLighter}>
                {t === 'expense' ? '支出' : '收入'}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* List */}
      {data.length === 0 ? (
        <AppText size="xl" color={colors.textLighter} style={styles.empty}>暂无数据</AppText>
      ) : (
        <View style={styles.list}>
          {visible.map((tx, index) => (
            <View key={tx.id} style={styles.row}>
              <AppText size="sm" color={colors.textLighter} style={styles.rank}>{index + 1}</AppText>
              <AppText size="xl" style={styles.emoji}>{tx.categoryEmoji}</AppText>
              <View style={styles.info}>
                <AppText size="md" weight="semibold" color={colors.text} numberOfLines={1}>{tx.categoryName}</AppText>
                <AppText size="sm" color={colors.textLighter} numberOfLines={1}>
                  {formatDate(tx.date)}{tx.note ? ` · ${tx.note}` : ''}
                </AppText>
              </View>
              <AppText size="md" weight="semibold" color={tab === 'expense' ? colors.coral : colors.sage}>
                {tab === 'expense' ? '-' : '+'}¥{tx.amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
              </AppText>
            </View>
          ))}
        </View>
      )}

      {/* Expand toggle */}
      {data.length > 3 && (
        <Pressable
          onPress={() => setExpanded(!expanded)}
          style={styles.expandBtn}
        >
          <AppText size="sm" color={colors.textLighter}>
            {expanded ? '↑ 收起' : '↓ 查看更多'}
          </AppText>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tabs:      { flexDirection: 'row', backgroundColor: colors.creamDark, borderRadius: 12, padding: 2 },
  tab:       { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 10 },
  tabActive: { backgroundColor: colors.coral },
  empty:     { textAlign: 'center', marginVertical: 20 },
  list:      { gap: 12 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rank:      { width: 16, textAlign: 'center' },
  emoji:     { width: 28, textAlign: 'center' },
  info:      { flex: 1 },
  expandBtn: { alignItems: 'center', marginTop: 12, paddingVertical: 4 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/stats/TransactionRankCard.tsx
git commit -m "feat(stats): add TransactionRankCard with inline expand"
```

---

## Task 7: 更新 stats.tsx — 数据层

**Files:**
- Modify: `apps/mobile/app/(tabs)/stats.tsx`

- [ ] **Step 1: 替换数据计算逻辑**

将 `stats.tsx` 改写为如下数据层（保留原有 import 头部，删除旧 useMemo 及常量）：

```tsx
import { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useLocalTransactions } from '../../hooks/useLocalTransactions';
import { useLocalCategories } from '../../hooks/useLocalCategories';
import { AccountSelectorBar } from '../../components/stats/AccountSelectorBar';
import { SummaryOverviewCard } from '../../components/stats/SummaryOverviewCard';
import { DailyTrendCard } from '../../components/stats/DailyTrendCard';
import { CategoryRankCard } from '../../components/stats/CategoryRankCard';
import { TransactionRankCard } from '../../components/stats/TransactionRankCard';
import { TrendInsightRow } from '../../components/stats/TrendInsightRow';
import { colors } from '../../constants/theme';
import {
  formatMonthLabelPadded,
  buildDateRangeLabel,
  computeDaysElapsed,
  buildDailyData,
  buildCategoryStats,
  buildTransactionRank,
} from '../../utils/statsUtils';
import type { Transaction, Category } from '@coco/shared';

const CATEGORY_COLORS = [
  colors.coral, colors.sage, colors.honey, colors.lavender,
  colors.coralLight, colors.sageLight,
] as const;

const AI_INSIGHTS = [
  { emoji: '🍜', title: '餐饮支出偏高', desc: '较上月增长 18%，建议控制外卖频次', badge: { text: '↑ 18%', direction: 'up' as const } },
  { emoji: '🚌', title: '交通支出正常', desc: '较上月减少 5%，保持得不错', badge: { text: '↓ 5%', direction: 'down' as const } },
  { emoji: '💡', title: '节省建议', desc: '本月如减少 3 次外卖，可省约 ¥120' },
];

export default function StatsScreen() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: txData }       = useLocalTransactions();
  const { data: categories = [] } = useLocalCategories();

  const allTransactions: readonly Transaction[] = txData?.data ?? [];

  const categoryMap = useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach((c) => { map[c.id] = c; });
    return map;
  }, [categories]);

  // 当月交易
  const filtered = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    return allTransactions.filter((tx) => {
      const d = new Date(tx.occurred_at);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [allTransactions, currentDate]);

  // 汇总
  const totalExpense = useMemo(
    () => filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    [filtered],
  );
  const totalIncome = useMemo(
    () => filtered.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
    [filtered],
  );
  const balance = totalIncome - totalExpense;

  // 日均
  const daysElapsed = useMemo(() => computeDaysElapsed(currentDate), [currentDate]);
  const avgExpense  = totalExpense / daysElapsed;
  const avgIncome   = totalIncome  / daysElapsed;
  const avgBalance  = balance      / daysElapsed;

  // 日维度数据（全月）
  const dailyData = useMemo(
    () => buildDailyData(filtered, currentDate),
    [filtered, currentDate],
  );

  // 分类统计（支出 + 收入分开）
  const expenseByCat = useMemo(
    () => buildCategoryStats(filtered, 'expense', categoryMap, CATEGORY_COLORS),
    [filtered, categoryMap],
  );
  const incomeByCat = useMemo(
    () => buildCategoryStats(filtered, 'income', categoryMap, CATEGORY_COLORS),
    [filtered, categoryMap],
  );

  // 明细排行
  const expenseRank = useMemo(
    () => buildTransactionRank(filtered, 'expense', categoryMap),
    [filtered, categoryMap],
  );
  const incomeRank = useMemo(
    () => buildTransactionRank(filtered, 'income', categoryMap),
    [filtered, categoryMap],
  );

  // 标签和日期范围
  const monthLabel     = formatMonthLabelPadded(currentDate);
  const dateRangeLabel = buildDateRangeLabel(currentDate);

  function handlePrev() {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  }
  function handleNext() {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AccountSelectorBar monthLabel={monthLabel} onPrev={handlePrev} onNext={handleNext} />
      <SummaryOverviewCard
        totalExpense={totalExpense} totalIncome={totalIncome} balance={balance}
        avgExpense={avgExpense} avgIncome={avgIncome} avgBalance={avgBalance}
        dateRangeLabel={dateRangeLabel}
      />
      <DailyTrendCard dailyData={dailyData} />
      <CategoryRankCard expenseByCategory={expenseByCat} incomeByCategory={incomeByCat} />
      <TransactionRankCard expenseTransactions={expenseRank} incomeTransactions={incomeRank} />
      <TrendInsightRow items={AI_INSIGHTS} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content:   { paddingTop: 56, paddingBottom: 32, gap: 16 },
});
```

- [ ] **Step 2: 运行单元测试，确认仍全绿**

```bash
cd apps/mobile && npx jest --no-coverage
```

期望：`PASS` — statsUtils 所有测试仍通过。

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(tabs\)/stats.tsx
git commit -m "feat(stats): rewire stats.tsx to use new components and statsUtils"
```

---

## Task 8: 删除旧组件

**Files:**
- Delete: `apps/mobile/components/stats/PeriodTabs.tsx`
- Delete: `apps/mobile/components/stats/MonthSelector.tsx`
- Delete: `apps/mobile/components/stats/BarChartCard.tsx`
- Delete: `apps/mobile/components/stats/DonutChartCard.tsx`

- [ ] **Step 1: 删除文件**

```bash
rm apps/mobile/components/stats/PeriodTabs.tsx \
   apps/mobile/components/stats/MonthSelector.tsx \
   apps/mobile/components/stats/BarChartCard.tsx \
   apps/mobile/components/stats/DonutChartCard.tsx
```

- [ ] **Step 2: 确认无残留引用**

```bash
cd apps/mobile && grep -r "PeriodTabs\|MonthSelector\|BarChartCard\|DonutChartCard" --include="*.tsx" --include="*.ts" .
```

期望：无输出。

- [ ] **Step 3: 运行测试，确认仍通过**

```bash
cd apps/mobile && npx jest --no-coverage
```

- [ ] **Step 4: Commit**

```bash
git rm apps/mobile/components/stats/PeriodTabs.tsx \
       apps/mobile/components/stats/MonthSelector.tsx \
       apps/mobile/components/stats/BarChartCard.tsx \
       apps/mobile/components/stats/DonutChartCard.tsx
git commit -m "chore(stats): remove deprecated PeriodTabs, MonthSelector, BarChartCard, DonutChartCard"
```

---

## 验收标准

- [ ] `npx jest --no-coverage` 全部通过
- [ ] 统计页显示：AccountSelectorBar + SummaryOverviewCard + DailyTrendCard + CategoryRankCard + TransactionRankCard + TrendInsightRow
- [ ] 月份导航切换可正确刷新所有卡片数据
- [ ] 每日趋势支持 支出/收入/结余 × 柱状图/折线图 四种组合切换
- [ ] 分类/明细排行榜"查看更多"可正常展开收起
- [ ] 无 TypeScript 编译错误（`tsc --noEmit`）

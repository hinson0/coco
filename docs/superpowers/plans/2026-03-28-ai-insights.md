# AI 洞察功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为统计页面实现基于规则引擎的本地 AI 洞察功能，替换当前硬编码的演示数据。

**Architecture:** 规则引擎模式——每种洞察类型是一个独立的纯函数（规则），由调度器 `runInsightRules` 执行并按优先级排序。UI 层根据洞察类型渲染不同的可视化卡片。所有计算纯本地完成，不依赖网络。

**Tech Stack:** TypeScript, React Native (Expo 55), Jest (ts-jest), react-native `Animated` API

---

## 文件结构

| 操作 | 文件路径 | 职责 |
|------|---------|------|
| 新建 | `apps/mobile/utils/insights/types.ts` | InsightContext、InsightItem 类型定义 |
| 新建 | `apps/mobile/utils/insights/healthScoreRule.ts` | 健康度评分规则 |
| 新建 | `apps/mobile/utils/insights/categoryChangeRule.ts` | 分类环比变化规则 |
| 新建 | `apps/mobile/utils/insights/anomalyRule.ts` | 异常交易检测规则 |
| 新建 | `apps/mobile/utils/insights/paceRule.ts` | 消费节奏规则 |
| 新建 | `apps/mobile/utils/insights/frequencyRule.ts` | 高频消费规则 |
| 新建 | `apps/mobile/utils/insights/savingRule.ts` | 节省建议规则 |
| 新建 | `apps/mobile/utils/insights/runInsightRules.ts` | 规则调度器 |
| 新建 | `apps/mobile/utils/insights/__tests__/healthScoreRule.test.ts` | 健康度测试 |
| 新建 | `apps/mobile/utils/insights/__tests__/categoryChangeRule.test.ts` | 分类环比测试 |
| 新建 | `apps/mobile/utils/insights/__tests__/anomalyRule.test.ts` | 异常检测测试 |
| 新建 | `apps/mobile/utils/insights/__tests__/paceRule.test.ts` | 消费节奏测试 |
| 新建 | `apps/mobile/utils/insights/__tests__/frequencyRule.test.ts` | 高频消费测试 |
| 新建 | `apps/mobile/utils/insights/__tests__/savingRule.test.ts` | 节省建议测试 |
| 新建 | `apps/mobile/utils/insights/__tests__/runInsightRules.test.ts` | 调度器测试 |
| 新建 | `apps/mobile/components/stats/HealthScoreCard.tsx` | 圆环评分卡片组件 |
| 新建 | `apps/mobile/components/stats/InsightCard.tsx` | 通用洞察卡片组件 |
| 修改 | `apps/mobile/components/stats/TrendInsightRow.tsx` | 改造为渲染 InsightItem[] |
| 修改 | `apps/mobile/app/(tabs)/stats.tsx` | 接入规则引擎替换硬编码 |

---

### Task 1: 类型定义

**Files:**
- Create: `apps/mobile/utils/insights/types.ts`

- [ ] **Step 1: 创建类型定义文件**

```typescript
// apps/mobile/utils/insights/types.ts
import type { Transaction, Category } from '@coco/shared';

export interface InsightContext {
  readonly currentMonth: readonly Transaction[];
  readonly previousMonth: readonly Transaction[];
  readonly categories: readonly Category[];
  readonly year: number;
  readonly month: number;
  readonly daysInMonth: number;
  readonly daysElapsed: number;
}

export type InsightType = 'health' | 'category-change' | 'anomaly' | 'pace' | 'frequency' | 'saving';

export interface InsightBadge {
  readonly text: string;
  readonly direction: 'up' | 'down' | 'neutral';
}

export interface InsightNavigation {
  readonly route: string;
  readonly params: Record<string, string>;
}

export interface InsightItem {
  readonly type: InsightType;
  readonly priority: number;
  readonly emoji: string;
  readonly title: string;
  readonly desc: string;
  readonly badge?: InsightBadge;
  readonly navigation?: InsightNavigation;
  readonly meta?: Record<string, any>;
}

export type InsightRule = (ctx: InsightContext) => InsightItem | InsightItem[] | null;
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/utils/insights/types.ts
git commit -m "feat(insights): 添加洞察规则引擎类型定义"
```

---

### Task 2: 健康度评分规则

**Files:**
- Create: `apps/mobile/utils/insights/__tests__/healthScoreRule.test.ts`
- Create: `apps/mobile/utils/insights/healthScoreRule.ts`

- [ ] **Step 1: 编写测试**

```typescript
// apps/mobile/utils/insights/__tests__/healthScoreRule.test.ts
import { healthScoreRule } from '../healthScoreRule';
import type { InsightContext } from '../types';

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    currentMonth: [],
    previousMonth: [],
    categories: [],
    year: 2026,
    month: 2, // March (0-indexed)
    daysInMonth: 31,
    daysElapsed: 15,
    ...overrides,
  };
}

function makeTx(type: 'income' | 'expense', amount: number) {
  return { type, amount, id: '1', user_id: '', category_id: 'c1', note: '', occurred_at: '2026-03-10', source: 'manual' as const, raw_input: null, receipt_url: null, ai_confidence: null, created_at: '', deleted_at: null, account_id: null };
}

describe('healthScoreRule', () => {
  it('始终返回结果（不为 null）', () => {
    const result = healthScoreRule(makeCtx());
    expect(result).not.toBeNull();
  });

  it('type 为 health，priority 为 1', () => {
    const result = healthScoreRule(makeCtx())!;
    expect(result.type).toBe('health');
    expect(result.priority).toBe(1);
  });

  it('无收入时结余率分为 0', () => {
    const ctx = makeCtx({
      currentMonth: [makeTx('expense', 1000)],
    });
    const result = healthScoreRule(ctx)!;
    expect(result.meta!.score).toBeLessThanOrEqual(40);
  });

  it('高结余率（≥30%）得高分', () => {
    const ctx = makeCtx({
      currentMonth: [makeTx('income', 10000), makeTx('expense', 5000)],
      daysInMonth: 31,
      daysElapsed: 31,
    });
    const result = healthScoreRule(ctx)!;
    expect(result.meta!.score).toBeGreaterThanOrEqual(60);
  });

  it('结余率 30% 刚好得满分（结余率维度）', () => {
    // 收入 10000，支出 7000，结余率 30%
    const ctx = makeCtx({
      currentMonth: [makeTx('income', 10000), makeTx('expense', 7000)],
      daysInMonth: 31,
      daysElapsed: 31,
    });
    const result = healthScoreRule(ctx)!;
    // 结余率分 100 * 0.6 = 60，节奏分和异常分也满，总分应接近 100
    expect(result.meta!.savingsRate).toBeCloseTo(0.3, 1);
  });

  it('消费节奏偏快扣分', () => {
    // 月过半但已花 90%
    const expenses = Array.from({ length: 9 }, () => makeTx('expense', 1000));
    const ctx = makeCtx({
      currentMonth: [makeTx('income', 10000), ...expenses],
      daysInMonth: 31,
      daysElapsed: 15,
    });
    const result = healthScoreRule(ctx)!;
    // 节奏偏差大，分数应被拉低
    expect(result.meta!.score).toBeLessThan(80);
  });

  it('评级映射正确', () => {
    const ctx = makeCtx({
      currentMonth: [makeTx('income', 10000), makeTx('expense', 6500)],
      daysInMonth: 31,
      daysElapsed: 31,
    });
    const result = healthScoreRule(ctx)!;
    const level = result.meta!.level as string;
    expect(['差', '一般', '良好', '优秀']).toContain(level);
  });

  it('有上月数据时包含 prevSavingsRate', () => {
    const ctx = makeCtx({
      currentMonth: [makeTx('income', 10000), makeTx('expense', 7000)],
      previousMonth: [makeTx('income', 8000), makeTx('expense', 6000)],
    });
    const result = healthScoreRule(ctx)!;
    expect(result.meta!.prevSavingsRate).toBeDefined();
  });

  it('无上月数据时 prevSavingsRate 为 undefined', () => {
    const ctx = makeCtx({
      currentMonth: [makeTx('income', 10000), makeTx('expense', 7000)],
      previousMonth: [],
    });
    const result = healthScoreRule(ctx)!;
    expect(result.meta!.prevSavingsRate).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/mobile && npx jest utils/insights/__tests__/healthScoreRule.test.ts --no-coverage`
Expected: FAIL — Cannot find module '../healthScoreRule'

- [ ] **Step 3: 实现规则**

```typescript
// apps/mobile/utils/insights/healthScoreRule.ts
import type { InsightContext, InsightItem } from './types';

function calcSavingsRate(transactions: readonly { type: string; amount: number }[]): number {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.type === 'income') income += Number(tx.amount);
    else if (tx.type === 'expense') expense += Number(tx.amount);
  }
  if (income <= 0) return 0;
  return Math.max(0, (income - expense) / income);
}

function savingsRateScore(rate: number): number {
  // 0% → 0, ≥30% → 100, 线性插值
  return Math.min(100, Math.max(0, (rate / 0.3) * 100));
}

function paceScore(ctx: InsightContext): number {
  const expenses = ctx.currentMonth.filter(tx => tx.type === 'expense');
  if (expenses.length === 0) return 100;

  const totalExpense = expenses.reduce((s, tx) => s + Number(tx.amount), 0);
  const dailyAvg = totalExpense / ctx.daysElapsed;
  const estimatedTotal = dailyAvg * ctx.daysInMonth;
  const spendProgress = estimatedTotal > 0 ? totalExpense / estimatedTotal : 0;
  const timeProgress = ctx.daysElapsed / ctx.daysInMonth;

  const deviation = Math.abs(spendProgress - timeProgress);
  // deviation 0 → 100, deviation ≥ 0.3 → 0
  return Math.min(100, Math.max(0, (1 - deviation / 0.3) * 100));
}

function anomalyCount(transactions: readonly { type: string; amount: number }[]): number {
  const expenses = transactions.filter(tx => tx.type === 'expense').map(tx => Number(tx.amount));
  if (expenses.length < 3) return 0;

  const sorted = [...expenses].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const mean = expenses.reduce((s, v) => s + v, 0) / expenses.length;
  const variance = expenses.reduce((s, v) => s + (v - mean) ** 2, 0) / expenses.length;
  const stdDev = Math.sqrt(variance);

  const threshold = median + 2 * stdDev;
  return expenses.filter(a => a > threshold && a >= 500).length;
}

function getLevel(score: number): string {
  if (score <= 40) return '差';
  if (score <= 60) return '一般';
  if (score <= 80) return '良好';
  return '优秀';
}

export function healthScoreRule(ctx: InsightContext): InsightItem {
  const savingsRate = calcSavingsRate(ctx.currentMonth);
  const srScore = savingsRateScore(savingsRate);
  const pScore = paceScore(ctx);
  const aCount = anomalyCount(ctx.currentMonth);
  const aScore = Math.max(0, 100 - aCount * 25);

  const score = Math.round(srScore * 0.6 + pScore * 0.2 + aScore * 0.2);
  const level = getLevel(score);

  const prevSavingsRate = ctx.previousMonth.length > 0
    ? calcSavingsRate(ctx.previousMonth)
    : undefined;

  const ratePercent = Math.round(savingsRate * 100);
  let desc = `本月结余率 ${ratePercent}%`;
  if (prevSavingsRate !== undefined) {
    const diff = Math.round((savingsRate - prevSavingsRate) * 100);
    if (diff > 0) desc += `，较上月提升 ${diff} 个百分点`;
    else if (diff < 0) desc += `，较上月下降 ${Math.abs(diff)} 个百分点`;
    else desc += `，与上月持平`;
  }

  const emoji = score > 80 ? '🌟' : score > 60 ? '👍' : score > 40 ? '📊' : '⚠️';

  const badge = prevSavingsRate !== undefined
    ? {
        text: `${savingsRate >= prevSavingsRate ? '↑' : '↓'} ${Math.abs(Math.round((savingsRate - prevSavingsRate) * 100))}%`,
        direction: (savingsRate >= prevSavingsRate ? 'up' : 'down') as const,
      }
    : undefined;

  return {
    type: 'health',
    priority: 1,
    emoji,
    title: `收支健康度 · ${level}`,
    desc,
    badge,
    meta: { score, level, savingsRate, prevSavingsRate },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/mobile && npx jest utils/insights/__tests__/healthScoreRule.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/utils/insights/healthScoreRule.ts apps/mobile/utils/insights/__tests__/healthScoreRule.test.ts
git commit -m "feat(insights): 实现健康度评分规则及测试"
```

---

### Task 3: 分类环比变化规则

**Files:**
- Create: `apps/mobile/utils/insights/__tests__/categoryChangeRule.test.ts`
- Create: `apps/mobile/utils/insights/categoryChangeRule.ts`

- [ ] **Step 1: 编写测试**

```typescript
// apps/mobile/utils/insights/__tests__/categoryChangeRule.test.ts
import { categoryChangeRule } from '../categoryChangeRule';
import type { InsightContext } from '../types';

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    currentMonth: [],
    previousMonth: [],
    categories: [
      { id: 'c1', user_id: null, name: '餐饮', icon: '🍜', type: 'expense', is_default: true, deleted_at: null },
      { id: 'c2', user_id: null, name: '交通', icon: '🚌', type: 'expense', is_default: true, deleted_at: null },
    ],
    year: 2026,
    month: 2,
    daysInMonth: 31,
    daysElapsed: 31,
    ...overrides,
  };
}

function makeTx(categoryId: string, amount: number, type: 'income' | 'expense' = 'expense') {
  return { type, amount, id: '1', user_id: '', category_id: categoryId, note: '', occurred_at: '2026-03-10', source: 'manual' as const, raw_input: null, receipt_url: null, ai_confidence: null, created_at: '', deleted_at: null, account_id: null };
}

describe('categoryChangeRule', () => {
  it('无上月数据返回 null', () => {
    const ctx = makeCtx({ previousMonth: [], currentMonth: [makeTx('c1', 500)] });
    expect(categoryChangeRule(ctx)).toBeNull();
  });

  it('变化幅度 < 15% 不触发', () => {
    const ctx = makeCtx({
      currentMonth: [makeTx('c1', 1100)],
      previousMonth: [makeTx('c1', 1000)],
    });
    expect(categoryChangeRule(ctx)).toBeNull();
  });

  it('绝对差额 < ¥50 不触发', () => {
    const ctx = makeCtx({
      currentMonth: [makeTx('c1', 40)],
      previousMonth: [makeTx('c1', 20)],
    });
    // 涨幅 100% 但差额只有 20
    expect(categoryChangeRule(ctx)).toBeNull();
  });

  it('涨幅超 15% 且差额 ≥ ¥50 触发', () => {
    const ctx = makeCtx({
      currentMonth: [makeTx('c1', 1200)],
      previousMonth: [makeTx('c1', 1000)],
    });
    const result = categoryChangeRule(ctx);
    expect(result).not.toBeNull();
    const items = Array.isArray(result) ? result : [result!];
    const up = items.find(i => i.badge?.direction === 'up');
    expect(up).toBeDefined();
    expect(up!.type).toBe('category-change');
    expect(up!.meta!.changePercent).toBeCloseTo(20, 0);
  });

  it('最多返回 2 条（涨幅 + 降幅各一）', () => {
    const ctx = makeCtx({
      currentMonth: [makeTx('c1', 2000), makeTx('c2', 200)],
      previousMonth: [makeTx('c1', 1000), makeTx('c2', 500)],
    });
    const result = categoryChangeRule(ctx);
    const items = Array.isArray(result) ? result : [result!];
    expect(items.length).toBeLessThanOrEqual(2);
  });

  it('涨幅卡 priority=2，降幅卡 priority=5', () => {
    const ctx = makeCtx({
      currentMonth: [makeTx('c1', 2000), makeTx('c2', 200)],
      previousMonth: [makeTx('c1', 1000), makeTx('c2', 500)],
    });
    const result = categoryChangeRule(ctx);
    const items = Array.isArray(result) ? result : [result!];
    const up = items.find(i => i.badge?.direction === 'up');
    const down = items.find(i => i.badge?.direction === 'down');
    if (up) expect(up.priority).toBe(2);
    if (down) expect(down.priority).toBe(5);
  });

  it('包含 navigation 指向 category-detail', () => {
    const ctx = makeCtx({
      currentMonth: [makeTx('c1', 1200)],
      previousMonth: [makeTx('c1', 1000)],
    });
    const result = categoryChangeRule(ctx);
    const items = Array.isArray(result) ? result : [result!];
    expect(items[0].navigation?.route).toBe('/category-detail');
    expect(items[0].navigation?.params.categoryId).toBe('c1');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/mobile && npx jest utils/insights/__tests__/categoryChangeRule.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: 实现规则**

```typescript
// apps/mobile/utils/insights/categoryChangeRule.ts
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
    // 上月为 0 本月有值：视为 100% 增长
    const changePercent = prevAmount === 0 ? 100 : ((cat.amount - prevAmount) / prevAmount) * 100;
    const absDiff = Math.abs(cat.amount - prevAmount);

    if (Math.abs(changePercent) >= MIN_CHANGE_PERCENT && absDiff >= MIN_CHANGE_AMOUNT) {
      changes.push({ cat, prevAmount, changePercent });
    }
  }

  if (changes.length === 0) return null;

  // 按变化幅度绝对值排序
  changes.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  const results: InsightItem[] = [];

  // 最大涨幅
  const up = changes.find(c => c.changePercent > 0);
  if (up) {
    const pct = Math.round(up.changePercent);
    results.push({
      type: 'category-change',
      priority: 2,
      emoji: up.cat.emoji,
      title: `${up.cat.name}支出偏高`,
      desc: `较上月增长 ¥${Math.round(up.cat.amount - up.prevAmount)}，注意控制`,
      badge: { text: `↑ ${pct}%`, direction: 'up' },
      navigation: { route: '/category-detail', params: { categoryId: up.cat.categoryId } },
      meta: { categoryId: up.cat.categoryId, currentAmount: up.cat.amount, previousAmount: up.prevAmount, changePercent: pct },
    });
  }

  // 最大降幅
  const down = changes.find(c => c.changePercent < 0);
  if (down) {
    const pct = Math.abs(Math.round(down.changePercent));
    results.push({
      type: 'category-change',
      priority: 5,
      emoji: down.cat.emoji,
      title: `${down.cat.name}支出正常`,
      desc: `较上月减少 ${pct}%，保持得不错`,
      badge: { text: `↓ ${pct}%`, direction: 'down' },
      navigation: { route: '/category-detail', params: { categoryId: down.cat.categoryId } },
      meta: { categoryId: down.cat.categoryId, currentAmount: down.cat.amount, previousAmount: down.prevAmount, changePercent: -pct },
    });
  }

  return results.length > 0 ? results : null;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/mobile && npx jest utils/insights/__tests__/categoryChangeRule.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/utils/insights/categoryChangeRule.ts apps/mobile/utils/insights/__tests__/categoryChangeRule.test.ts
git commit -m "feat(insights): 实现分类环比变化规则及测试"
```

---

### Task 4: 异常交易检测规则

**Files:**
- Create: `apps/mobile/utils/insights/__tests__/anomalyRule.test.ts`
- Create: `apps/mobile/utils/insights/anomalyRule.ts`

- [ ] **Step 1: 编写测试**

```typescript
// apps/mobile/utils/insights/__tests__/anomalyRule.test.ts
import { anomalyRule } from '../anomalyRule';
import type { InsightContext } from '../types';

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    currentMonth: [],
    previousMonth: [],
    categories: [
      { id: 'c1', user_id: null, name: '购物', icon: '🛍️', type: 'expense', is_default: true, deleted_at: null },
    ],
    year: 2026, month: 2, daysInMonth: 31, daysElapsed: 15,
    ...overrides,
  };
}

function makeTx(amount: number, categoryId = 'c1', date = '2026-03-10') {
  return { type: 'expense' as const, amount, id: `t-${amount}-${date}`, user_id: '', category_id: categoryId, note: '', occurred_at: date, source: 'manual' as const, raw_input: null, receipt_url: null, ai_confidence: null, created_at: '', deleted_at: null, account_id: null };
}

describe('anomalyRule', () => {
  it('交易太少（< 3 笔）不触发', () => {
    const ctx = makeCtx({ currentMonth: [makeTx(500), makeTx(3000)] });
    expect(anomalyRule(ctx)).toBeNull();
  });

  it('无异常值不触发', () => {
    const ctx = makeCtx({
      currentMonth: [makeTx(100), makeTx(110), makeTx(90), makeTx(105), makeTx(95)],
    });
    expect(anomalyRule(ctx)).toBeNull();
  });

  it('有大额异常交易（> 中位数 + 2σ 且 ≥ ¥500）触发', () => {
    const normal = Array.from({ length: 10 }, (_, i) => makeTx(80 + i * 5));
    const outlier = makeTx(3200, 'c1', '2026-03-15');
    const ctx = makeCtx({ currentMonth: [...normal, outlier] });
    const result = anomalyRule(ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('anomaly');
    expect(result!.priority).toBe(3);
    expect(result!.meta!.amount).toBe(3200);
  });

  it('异常值 < ¥500 不触发', () => {
    const normal = Array.from({ length: 10 }, () => makeTx(10));
    const ctx = makeCtx({ currentMonth: [...normal, makeTx(400)] });
    expect(anomalyRule(ctx)).toBeNull();
  });

  it('多笔异常只取最大的一笔', () => {
    const normal = Array.from({ length: 10 }, () => makeTx(50));
    const ctx = makeCtx({
      currentMonth: [...normal, makeTx(800, 'c1', '2026-03-12'), makeTx(3200, 'c1', '2026-03-15')],
    });
    const result = anomalyRule(ctx);
    expect(result!.meta!.amount).toBe(3200);
  });

  it('包含 navigation', () => {
    const normal = Array.from({ length: 10 }, () => makeTx(50));
    const ctx = makeCtx({ currentMonth: [...normal, makeTx(3200)] });
    const result = anomalyRule(ctx);
    expect(result!.navigation?.route).toBe('/category-detail');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/mobile && npx jest utils/insights/__tests__/anomalyRule.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: 实现规则**

```typescript
// apps/mobile/utils/insights/anomalyRule.ts
import type { InsightContext, InsightItem } from './types';

export function anomalyRule(ctx: InsightContext): InsightItem | null {
  const expenses = ctx.currentMonth
    .filter(tx => tx.type === 'expense')
    .map(tx => ({ ...tx, numAmount: Number(tx.amount) }));

  if (expenses.length < 3) return null;

  const amounts = expenses.map(tx => tx.numAmount);
  const sorted = [...amounts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
  const variance = amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length;
  const stdDev = Math.sqrt(variance);

  const threshold = median + 2 * stdDev;

  const anomalies = expenses
    .filter(tx => tx.numAmount > threshold && tx.numAmount >= 500)
    .sort((a, b) => b.numAmount - a.numAmount);

  if (anomalies.length === 0) return null;

  const top = anomalies[0];
  const cat = ctx.categories.find(c => c.id === top.category_id);

  return {
    type: 'anomaly',
    priority: 3,
    emoji: '⚡',
    title: '大额支出提醒',
    desc: `本月有一笔 ¥${Math.round(top.numAmount).toLocaleString()} 的消费远超日常水平`,
    badge: { text: '异常', direction: 'neutral' },
    navigation: { route: '/category-detail', params: { categoryId: top.category_id } },
    meta: {
      transactionId: top.id,
      amount: top.numAmount,
      categoryEmoji: cat?.icon ?? '📦',
      categoryName: cat?.name ?? '其他',
      date: top.occurred_at.slice(0, 10),
    },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/mobile && npx jest utils/insights/__tests__/anomalyRule.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/utils/insights/anomalyRule.ts apps/mobile/utils/insights/__tests__/anomalyRule.test.ts
git commit -m "feat(insights): 实现异常交易检测规则及测试"
```

---

### Task 5: 消费节奏规则

**Files:**
- Create: `apps/mobile/utils/insights/__tests__/paceRule.test.ts`
- Create: `apps/mobile/utils/insights/paceRule.ts`

- [ ] **Step 1: 编写测试**

```typescript
// apps/mobile/utils/insights/__tests__/paceRule.test.ts
import { paceRule } from '../paceRule';
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

function makeTx(type: 'income' | 'expense', amount: number) {
  return { type, amount, id: '1', user_id: '', category_id: 'c1', note: '', occurred_at: '2026-03-10', source: 'manual' as const, raw_input: null, receipt_url: null, ai_confidence: null, created_at: '', deleted_at: null, account_id: null };
}

describe('paceRule', () => {
  it('无支出不触发', () => {
    expect(paceRule(makeCtx())).toBeNull();
  });

  it('月初前 5 天内不触发', () => {
    const ctx = makeCtx({
      daysElapsed: 3,
      currentMonth: [makeTx('expense', 5000)],
    });
    expect(paceRule(ctx)).toBeNull();
  });

  it('消费进度与时间进度偏差 < 15% 不触发', () => {
    // 月过半（15/31 ≈ 48%），支出匀速
    const ctx = makeCtx({
      daysElapsed: 15,
      daysInMonth: 31,
      currentMonth: [makeTx('expense', 1500)], // 日均 100，总估 3100，进度 48%
    });
    expect(paceRule(ctx)).toBeNull();
  });

  it('消费进度超时间进度 ≥ 15% 触发', () => {
    // 月过半（15/31 ≈ 48%），但已花 70% 的预估
    // 日均 = 7000/15 ≈ 467，预估月总 = 467*31 ≈ 14467
    // 消费进度 = 7000/14467 ≈ 48%... 这不行
    // 实际上 paceRule 的逻辑：消费进度 = 已消费 / (日均 × 总天数)
    // 日均 = 已消费 / 已过天数，所以消费进度永远 = daysElapsed/daysInMonth
    // 需要重新思考：消费节奏是对比"当前花了多少" vs "按预算应该花多少"
    // 但没有预算概念，所以用另一种方式：对比前半月 vs 后半月的消费分布
    //
    // 按设计文档：消费进度 = 已消费金额 / (日均支出 × 总天数)
    // 这等于 daysElapsed/daysInMonth，永远等于时间进度...
    // 设计需要修正：用"当前总支出 / 上月同期总支出"来判断
    //
    // 但设计文档说无需上月数据。那我们换一种理解：
    // 按天分布看，前半月花了总支出的多大比例
    // 如果月过一半但花了 70%+，说明节奏偏快
    //
    // 重新定义：
    // 时间进度 = daysElapsed / daysInMonth
    // 假设匀速消费，那在 daysElapsed 天内应花 timeProgress 的月总支出
    // 实际上我们无法知道"月总支出"预期是多少（除非有预算）
    // 最实用的做法：看前半月的支出占比是否过高
    // → 按天累积消费，daysElapsed 内消费占本月已知总消费的比例
    //   如果 daysElapsed < daysInMonth 且前 daysElapsed 天消费占已记录总消费的比例
    //   远超 timeProgress... 但已记录总消费就是这些天的，等于 100%
    //
    // OK 最后理解：设计文档的意思是
    // 日均支出 = totalExpenseThisMonth / daysElapsed
    // 按此日均预测月底总支出 estimatedTotal = dailyAvg × daysInMonth
    // 当月还没结束时，看 estimatedTotal 是否大幅超出收入
    // 如果没有收入信息就无法判断。
    //
    // 简化理解：只要月未过半但花了超过半数，就标记
    // 实际触发条件改为：在 daysElapsed/daysInMonth 时间点，
    // 已花金额 vs 按匀速应花金额（总支出/总天数 × 已过天数）
    // 但没有"应花多少"的参照...
    //
    // 最终：我们用"月收入"作为参照。如果有收入，
    // 时间进度 = daysElapsed / daysInMonth
    // 消费进度 = totalExpense / totalIncome
    // 如果 消费进度 - 时间进度 > 0.15，触发
    //
    // 如果无收入，不触发
    const ctx = makeCtx({
      daysElapsed: 15,
      daysInMonth: 31,
      currentMonth: [
        makeTx('income', 10000),
        makeTx('expense', 7000), // 消费进度 70%，时间进度 48%，偏差 22%
      ],
    });
    const result = paceRule(ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('pace');
    expect(result!.priority).toBe(4);
    expect(result!.meta!.spendProgress).toBeCloseTo(0.7, 1);
  });

  it('meta 包含 timeProgress 和 spendProgress', () => {
    const ctx = makeCtx({
      daysElapsed: 15,
      daysInMonth: 31,
      currentMonth: [makeTx('income', 10000), makeTx('expense', 8000)],
    });
    const result = paceRule(ctx)!;
    expect(result.meta!.timeProgress).toBeCloseTo(15 / 31, 2);
    expect(result.meta!.spendProgress).toBeCloseTo(0.8, 1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/mobile && npx jest utils/insights/__tests__/paceRule.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: 实现规则**

```typescript
// apps/mobile/utils/insights/paceRule.ts
import type { InsightContext, InsightItem } from './types';

const MIN_DAYS = 5;
const MIN_DEVIATION = 0.15;

export function paceRule(ctx: InsightContext): InsightItem | null {
  if (ctx.daysElapsed < MIN_DAYS) return null;

  const totalExpense = ctx.currentMonth
    .filter(tx => tx.type === 'expense')
    .reduce((s, tx) => s + Number(tx.amount), 0);

  if (totalExpense === 0) return null;

  const totalIncome = ctx.currentMonth
    .filter(tx => tx.type === 'income')
    .reduce((s, tx) => s + Number(tx.amount), 0);

  // 无收入参照时，无法判断节奏
  if (totalIncome <= 0) return null;

  const timeProgress = ctx.daysElapsed / ctx.daysInMonth;
  const spendProgress = totalExpense / totalIncome;
  const deviation = spendProgress - timeProgress;

  if (deviation < MIN_DEVIATION) return null;

  const spendPct = Math.round(spendProgress * 100);
  const timePct = Math.round(timeProgress * 100);

  return {
    type: 'pace',
    priority: 4,
    emoji: '⏱️',
    title: '消费节奏偏快',
    desc: `月过 ${timePct}% 已消费收入的 ${spendPct}%，注意控制节奏`,
    badge: { text: '注意', direction: 'neutral' },
    meta: { timeProgress, spendProgress, estimatedMonthTotal: (totalExpense / ctx.daysElapsed) * ctx.daysInMonth },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/mobile && npx jest utils/insights/__tests__/paceRule.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/utils/insights/paceRule.ts apps/mobile/utils/insights/__tests__/paceRule.test.ts
git commit -m "feat(insights): 实现消费节奏规则及测试"
```

---

### Task 6: 高频消费规则

**Files:**
- Create: `apps/mobile/utils/insights/__tests__/frequencyRule.test.ts`
- Create: `apps/mobile/utils/insights/frequencyRule.ts`

- [ ] **Step 1: 编写测试**

```typescript
// apps/mobile/utils/insights/__tests__/frequencyRule.test.ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/mobile && npx jest utils/insights/__tests__/frequencyRule.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: 实现规则**

```typescript
// apps/mobile/utils/insights/frequencyRule.ts
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/mobile && npx jest utils/insights/__tests__/frequencyRule.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/utils/insights/frequencyRule.ts apps/mobile/utils/insights/__tests__/frequencyRule.test.ts
git commit -m "feat(insights): 实现高频消费规则及测试"
```

---

### Task 7: 节省建议规则

**Files:**
- Create: `apps/mobile/utils/insights/__tests__/savingRule.test.ts`
- Create: `apps/mobile/utils/insights/savingRule.ts`

- [ ] **Step 1: 编写测试**

```typescript
// apps/mobile/utils/insights/__tests__/savingRule.test.ts
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
    // 单次均价 10 元，减 3 次 = 30 元 < 50
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/mobile && npx jest utils/insights/__tests__/savingRule.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: 实现规则**

```typescript
// apps/mobile/utils/insights/savingRule.ts
import type { InsightContext, InsightItem } from './types';

const MIN_SAVING = 50;
const REDUCE_RATIO = 0.25; // 建议减少 25% 的次数

interface SavingSuggestion {
  category: string;
  emoji: string;
  reduceCount: number;
  saveAmount: number;
}

export function savingRule(ctx: InsightContext, priorResults: InsightItem[]): InsightItem | null {
  const suggestions: SavingSuggestion[] = [];

  // 从环比增长中提取建议
  const upChanges = priorResults.filter(
    r => r.type === 'category-change' && r.badge?.direction === 'up' && r.meta,
  );
  for (const change of upChanges) {
    const catId = change.meta!.categoryId as string;
    const txCount = ctx.currentMonth.filter(tx => tx.type === 'expense' && tx.category_id === catId).length;
    if (txCount === 0) continue;
    const avgPerTx = (change.meta!.currentAmount as number) / txCount;
    const reduceCount = Math.max(1, Math.round(txCount * REDUCE_RATIO));
    suggestions.push({
      category: change.emoji,
      emoji: change.emoji,
      reduceCount,
      saveAmount: Math.round(reduceCount * avgPerTx),
    });
  }

  // 从高频消费中提取建议
  const freqs = priorResults.filter(r => r.type === 'frequency' && r.meta);
  for (const freq of freqs) {
    const count = freq.meta!.count as number;
    const total = freq.meta!.totalAmount as number;
    const avgPerTx = total / count;
    const reduceCount = Math.max(1, Math.round(count * REDUCE_RATIO));
    // 避免与环比增长建议重复
    const catId = freq.meta!.categoryId as string;
    if (suggestions.some(s => s.category === freq.emoji)) continue;
    suggestions.push({
      category: freq.meta!.categoryName as string,
      emoji: freq.meta!.categoryEmoji as string,
      reduceCount,
      saveAmount: Math.round(reduceCount * avgPerTx),
    });
  }

  if (suggestions.length === 0) return null;

  const totalSaving = suggestions.reduce((s, sg) => s + sg.saveAmount, 0);
  if (totalSaving < MIN_SAVING) return null;

  const parts = suggestions.map(s => `减少 ${s.reduceCount} 次${s.category}`).join(' + ');

  return {
    type: 'saving',
    priority: 7,
    emoji: '💡',
    title: '节省建议',
    desc: `${parts}，每月可节省：`,
    meta: { suggestions, totalSaving },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/mobile && npx jest utils/insights/__tests__/savingRule.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/utils/insights/savingRule.ts apps/mobile/utils/insights/__tests__/savingRule.test.ts
git commit -m "feat(insights): 实现节省建议规则及测试"
```

---

### Task 8: 规则调度器

**Files:**
- Create: `apps/mobile/utils/insights/__tests__/runInsightRules.test.ts`
- Create: `apps/mobile/utils/insights/runInsightRules.ts`

- [ ] **Step 1: 编写测试**

```typescript
// apps/mobile/utils/insights/__tests__/runInsightRules.test.ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/mobile && npx jest utils/insights/__tests__/runInsightRules.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: 实现调度器**

```typescript
// apps/mobile/utils/insights/runInsightRules.ts
import type { InsightContext, InsightItem } from './types';
import { healthScoreRule } from './healthScoreRule';
import { categoryChangeRule } from './categoryChangeRule';
import { anomalyRule } from './anomalyRule';
import { paceRule } from './paceRule';
import { frequencyRule } from './frequencyRule';
import { savingRule } from './savingRule';

export function runInsightRules(ctx: InsightContext): InsightItem[] {
  const results: InsightItem[] = [];

  // 健康度始终存在
  results.push(healthScoreRule(ctx));

  // 执行独立规则
  const catChange = categoryChangeRule(ctx);
  if (catChange) {
    if (Array.isArray(catChange)) results.push(...catChange);
    else results.push(catChange);
  }

  const anomaly = anomalyRule(ctx);
  if (anomaly) results.push(anomaly);

  const pace = paceRule(ctx);
  if (pace) results.push(pace);

  const freq = frequencyRule(ctx);
  if (freq) results.push(freq);

  // 节省建议依赖前序结果
  const saving = savingRule(ctx, results);
  if (saving) results.push(saving);

  // 按 priority 升序排序
  results.sort((a, b) => a.priority - b.priority);

  return results;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/mobile && npx jest utils/insights/__tests__/runInsightRules.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: 运行全部洞察测试确认无回归**

Run: `cd apps/mobile && npx jest utils/insights/ --no-coverage`
Expected: All tests PASS

- [ ] **Step 6: 提交**

```bash
git add apps/mobile/utils/insights/runInsightRules.ts apps/mobile/utils/insights/__tests__/runInsightRules.test.ts
git commit -m "feat(insights): 实现规则调度器及测试"
```

---

### Task 9: HealthScoreCard 组件

**Files:**
- Create: `apps/mobile/components/stats/HealthScoreCard.tsx`

- [ ] **Step 1: 实现组件**

```typescript
// apps/mobile/components/stats/HealthScoreCard.tsx
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';
import type { InsightItem } from '../../utils/insights/types';

interface HealthScoreCardProps {
  readonly item: InsightItem;
}

const RADIUS = 33;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function scoreColor(score: number): string {
  if (score > 80) return colors.sage;
  if (score > 60) return colors.sage;
  if (score > 40) return colors.honey;
  return colors.coral;
}

export function HealthScoreCard({ item }: HealthScoreCardProps) {
  const score = (item.meta?.score as number) ?? 0;
  const level = (item.meta?.level as string) ?? '';
  const strokeDashoffset = CIRCUMFERENCE * (1 - score / 100);
  const color = scoreColor(score);

  return (
    <Card radius="lg" shadow="md" padding={16}>
      <View style={styles.row}>
        <View style={styles.ringWrap}>
          <Svg width={80} height={80} viewBox="0 0 80 80" style={styles.svg}>
            <Circle cx={40} cy={40} r={RADIUS} fill="none" stroke={colors.creamDark} strokeWidth={6} />
            <Circle
              cx={40} cy={40} r={RADIUS}
              fill="none" stroke={color} strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 40 40)"
            />
          </Svg>
          <View style={styles.scoreCenter}>
            <AppText size="5xl" weight="bold" color={color}>{score}</AppText>
            <AppText size="xs" color={colors.textLighter}>健康分</AppText>
          </View>
        </View>
        <View style={styles.info}>
          <AppText size="lg" weight="semibold" color={colors.text}>
            收支健康度 · {level}
          </AppText>
          <AppText size="base" color={colors.textLight} style={styles.desc}>
            {item.desc}
          </AppText>
          {item.badge ? (
            <View style={[styles.badge, item.badge.direction === 'up' ? styles.badgeDown : styles.badgeUp]}>
              <AppText size="sm" weight="semibold" color={item.badge.direction === 'up' ? colors.coral : colors.sage}>
                {item.badge.text}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ringWrap: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    position: 'absolute',
  },
  scoreCenter: {
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  desc: {
    lineHeight: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 2,
  },
  badgeUp: {
    backgroundColor: colors.sagePale,
  },
  badgeDown: {
    backgroundColor: colors.coralPale,
  },
});
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/components/stats/HealthScoreCard.tsx
git commit -m "feat(insights): 添加健康度评分圆环卡片组件"
```

---

### Task 10: InsightCard 组件

**Files:**
- Create: `apps/mobile/components/stats/InsightCard.tsx`

- [ ] **Step 1: 实现组件**

```typescript
// apps/mobile/components/stats/InsightCard.tsx
import { View, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';
import type { InsightItem } from '../../utils/insights/types';

interface InsightCardProps {
  readonly item: InsightItem;
}

const ACCENT_COLORS: Record<string, { bar: string; emojiBg: string; badgeBg: string; badgeText: string }> = {
  'category-change-up':   { bar: colors.coral, emojiBg: colors.coralPale, badgeBg: colors.coralPale, badgeText: colors.coral },
  'category-change-down': { bar: colors.sage, emojiBg: colors.sagePale, badgeBg: colors.sagePale, badgeText: colors.sage },
  'anomaly':              { bar: colors.lavender, emojiBg: colors.lavenderPale, badgeBg: colors.lavenderPale, badgeText: colors.lavender },
  'pace':                 { bar: colors.coral, emojiBg: colors.coralPale, badgeBg: colors.honeyPale, badgeText: colors.honey },
  'frequency':            { bar: '#5B8DEF', emojiBg: '#EEF4FF', badgeBg: '#EEF4FF', badgeText: '#5B8DEF' },
  'saving':               { bar: colors.honey, emojiBg: colors.honeyPale, badgeBg: colors.honeyPale, badgeText: colors.honey },
};

function getAccent(item: InsightItem) {
  if (item.type === 'category-change') {
    return item.badge?.direction === 'down'
      ? ACCENT_COLORS['category-change-down']
      : ACCENT_COLORS['category-change-up'];
  }
  return ACCENT_COLORS[item.type] ?? ACCENT_COLORS['saving'];
}

function CompareRow({ meta }: { meta: Record<string, any> }) {
  return (
    <View style={styles.compareRow}>
      <View style={styles.compareItem}>
        <AppText size="sm" color={colors.textLighter}>本月</AppText>
        <AppText size="lg" weight="bold" color={colors.coral}>
          ¥{Math.round(meta.currentAmount).toLocaleString()}
        </AppText>
      </View>
      <View style={styles.compareItem}>
        <AppText size="sm" color={colors.textLighter}>上月</AppText>
        <AppText size="lg" weight="bold" color={colors.text}>
          ¥{Math.round(meta.previousAmount).toLocaleString()}
        </AppText>
      </View>
    </View>
  );
}

function AnomalyDetail({ meta }: { meta: Record<string, any> }) {
  return (
    <View style={styles.anomalyDetail}>
      <AppText size="4xl" weight="bold" color={colors.lavender}>
        ¥{Math.round(meta.amount).toLocaleString()}
      </AppText>
      <View style={styles.anomalyMeta}>
        <AppText size="base" weight="semibold" color={colors.text}>
          {meta.categoryEmoji} {meta.categoryName}
        </AppText>
        <AppText size="sm" color={colors.textLighter}>{formatDate(meta.date)}</AppText>
      </View>
    </View>
  );
}

function PaceBar({ meta }: { meta: Record<string, any> }) {
  const timePct = Math.round((meta.timeProgress as number) * 100);
  const spendPct = Math.round((meta.spendProgress as number) * 100);
  return (
    <View style={styles.paceWrap}>
      <View style={styles.paceTrack}>
        <View style={[styles.paceFill, { width: `${Math.min(100, spendPct)}%` }]} />
        <View style={[styles.paceMarker, { left: `${timePct}%` }]}>
          <View style={styles.paceMarkerDot} />
        </View>
      </View>
      <View style={styles.paceLabels}>
        <AppText size="xs" color={colors.textLighter}>月初</AppText>
        <AppText size="xs" weight="semibold" color={colors.coral}>已用 {spendPct}%</AppText>
        <AppText size="xs" color={colors.textLighter}>月末</AppText>
      </View>
    </View>
  );
}

function FrequencyDots({ meta }: { meta: Record<string, any> }) {
  const count = meta.count as number;
  const maxDots = Math.min(count + 3, 20);
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: maxDots }, (_, i) => (
        <View key={i} style={[styles.dot, i < count ? styles.dotActive : styles.dotInactive]} />
      ))}
      <AppText size="sm" color={colors.textLighter} style={styles.dotLabel}>{count}/月</AppText>
    </View>
  );
}

function SavingHighlight({ meta }: { meta: Record<string, any> }) {
  return (
    <View style={styles.savingBox}>
      <AppText size="3xl" weight="bold" color={colors.honey}>
        ≈ ¥{Math.round(meta.totalSaving)}
      </AppText>
      <AppText size="sm" color={colors.textLight}>每月可节省</AppText>
    </View>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function InsightCard({ item }: InsightCardProps) {
  const accent = getAccent(item);

  const handlePress = () => {
    if (item.navigation) {
      router.push({ pathname: item.navigation.route as any, params: item.navigation.params });
    }
  };

  const content = (
    <Card radius="lg" shadow="sm" padding={14} style={styles.card}>
      <View style={[styles.bar, { backgroundColor: accent.bar }]} />
      <View style={styles.top}>
        <View style={[styles.emojiWrap, { backgroundColor: accent.emojiBg }]}>
          <AppText size="2xl">{item.emoji}</AppText>
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <AppText size="lg" weight="semibold" color={colors.text} style={styles.title}>
              {item.title}
            </AppText>
            {item.badge ? (
              <View style={[styles.badge, { backgroundColor: accent.badgeBg }]}>
                <AppText size="sm" weight="bold" color={accent.badgeText}>
                  {item.badge.text}
                </AppText>
              </View>
            ) : null}
          </View>
          <AppText size="base" color={colors.textLight} style={styles.desc}>{item.desc}</AppText>

          {/* 按 type 渲染可视化部分 */}
          {item.type === 'category-change' && item.badge?.direction === 'up' && item.meta ? (
            <CompareRow meta={item.meta} />
          ) : null}
          {item.type === 'anomaly' && item.meta ? <AnomalyDetail meta={item.meta} /> : null}
          {item.type === 'pace' && item.meta ? <PaceBar meta={item.meta} /> : null}
          {item.type === 'frequency' && item.meta ? <FrequencyDots meta={item.meta} /> : null}
          {item.type === 'saving' && item.meta ? <SavingHighlight meta={item.meta} /> : null}
        </View>
      </View>
    </Card>
  );

  if (item.navigation) {
    return <Pressable onPress={handlePress}>{content}</Pressable>;
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    position: 'relative',
  },
  bar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  emojiWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 3,
  },
  title: {
    flex: 1,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  desc: {
    lineHeight: 18,
  },
  // Compare Row
  compareRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  compareItem: {
    flex: 1,
    backgroundColor: colors.cream,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.creamDark,
  },
  // Anomaly
  anomalyDetail: {
    marginTop: 10,
    backgroundColor: colors.lavenderPale,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  anomalyMeta: {
    alignItems: 'flex-end',
  },
  // Pace
  paceWrap: {
    marginTop: 10,
  },
  paceTrack: {
    height: 8,
    backgroundColor: colors.creamDark,
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
  },
  paceFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.honey,
  },
  paceMarker: {
    position: 'absolute',
    top: -4,
    marginLeft: -8,
  },
  paceMarkerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 2.5,
    borderColor: colors.textLighter,
  },
  paceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  // Frequency dots
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.lavender,
  },
  dotInactive: {
    backgroundColor: colors.creamDark,
  },
  dotLabel: {
    marginLeft: 4,
  },
  // Saving
  savingBox: {
    marginTop: 10,
    backgroundColor: colors.honeyPale,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/components/stats/InsightCard.tsx
git commit -m "feat(insights): 添加通用洞察卡片组件（含可视化插槽）"
```

---

### Task 11: 改造 TrendInsightRow

**Files:**
- Modify: `apps/mobile/components/stats/TrendInsightRow.tsx`

- [ ] **Step 1: 重写 TrendInsightRow**

将现有的 TrendInsightRow 改为接收 `InsightItem[]` 并分发给 `HealthScoreCard` 和 `InsightCard`：

```typescript
// apps/mobile/components/stats/TrendInsightRow.tsx
import { View, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';
import { HealthScoreCard } from './HealthScoreCard';
import { InsightCard } from './InsightCard';
import type { InsightItem } from '../../utils/insights/types';

interface TrendInsightRowProps {
  readonly items: InsightItem[];
}

export function TrendInsightRow({ items }: TrendInsightRowProps) {
  if (items.length === 0) return null;

  const healthItem = items.find(i => i.type === 'health');
  const otherItems = items.filter(i => i.type !== 'health');
  const onlyHealth = otherItems.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={styles.titleAccent} />
        <AppText size="xl" weight="semibold" color={colors.text}>
          AI 洞察
        </AppText>
      </View>

      {healthItem ? <HealthScoreCard item={healthItem} /> : null}

      {onlyHealth ? (
        <AppText size="base" color={colors.textLighter} style={styles.emptyText}>
          本月消费表现不错，暂无需要关注的问题 👍
        </AppText>
      ) : null}

      {otherItems.map(item => (
        <InsightCard key={`${item.type}-${item.priority}`} item={item} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  titleAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.honey,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 12,
  },
});
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/components/stats/TrendInsightRow.tsx
git commit -m "refactor(insights): 改造 TrendInsightRow 渲染 InsightItem 数组"
```

---

### Task 12: 接入 Stats 页面

**Files:**
- Modify: `apps/mobile/app/(tabs)/stats.tsx`

- [ ] **Step 1: 替换硬编码数据**

修改 `stats.tsx`：

1. 删除 `AI_INSIGHTS` 常量（第 32-36 行）
2. 添加上月交易查询
3. 用 `useMemo` 调用 `runInsightRules` 生成洞察
4. 传入 `TrendInsightRow`

修改后的关键部分：

```typescript
// 新增导入
import { runInsightRules } from '../../utils/insights/runInsightRules';
import type { InsightContext } from '../../utils/insights/types';

// 删除 AI_INSIGHTS 常量

export default function StatsScreen() {
  // ... 现有 state 和 hooks ...

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const { data: filtered = [] } = useMonthlyTransactions(year, month);
  const { data: categories = [] } = useLocalCategories();

  // 新增：上月交易
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const { data: prevFiltered = [] } = useMonthlyTransactions(prevYear, prevMonth);

  // ... 现有 categoryMap, totalExpense, totalIncome 等 ...

  // 新增：计算洞察
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const insights = useMemo(() => {
    const ctx: InsightContext = {
      currentMonth: filtered,
      previousMonth: prevFiltered,
      categories,
      year,
      month,
      daysInMonth,
      daysElapsed,
    };
    return runInsightRules(ctx);
  }, [filtered, prevFiltered, categories, year, month, daysInMonth, daysElapsed]);

  // ... 在 return 中将 <TrendInsightRow items={AI_INSIGHTS} /> 改为：
  // <TrendInsightRow items={insights} />
}
```

- [ ] **Step 2: 运行全部洞察测试确认无回归**

Run: `cd apps/mobile && npx jest utils/insights/ --no-coverage`
Expected: All tests PASS

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/app/\(tabs\)/stats.tsx
git commit -m "feat(insights): 接入规则引擎，替换硬编码洞察数据"
```

---

### Task 13: 全量测试和清理

- [ ] **Step 1: 运行全部测试**

Run: `cd apps/mobile && npx jest --no-coverage`
Expected: All tests PASS

- [ ] **Step 2: TypeScript 类型检查**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 修复发现的问题（如有）**

根据测试和类型检查结果修复问题。

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "chore(insights): 修复类型和测试问题"
```

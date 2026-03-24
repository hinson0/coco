# PRD：统计页面布局重构

**日期：** 2026-03-24
**分支：** feat-statistics
**范围：** `apps/mobile/app/(tabs)/stats.tsx` 及 `apps/mobile/components/stats/` 下全部 stats 组件

---

## 1. 背景与目标

当前统计页面布局简陋，信息密度低，与产品参考设计（黄色小鸭风格）差距较大。本次重构目标：

- 与参考设计视觉一致（收支总览卡、日趋势图、分类/明细排行榜）
- 去除 PeriodTabs（周/月/年），固定为月视图
- 保持数据计算逻辑不变，仅替换 View 层

---

## 2. 确认的需求决策

| 决策点 | 选择 |
|--------|------|
| 账本选择器 | 占位样式，`onPress` 为空 |
| 周期切换 | 去掉 PeriodTabs，固定月视图 |
| 每日趋势图 | 支出/收入/结余 × 柱状图/折线图 完整实现 |
| 查看更多 | inline 展开，最多显示 10 条后收起 |

---

## 3. 整体页面结构

```
stats.tsx (ScrollView, backgroundColor: colors.cream)
├── AccountSelectorBar       ← 新建
├── SummaryOverviewCard      ← 新建（替换 summaryRow 3格）
├── DailyTrendCard           ← 新建（替换 BarChartCard）
├── CategoryRankCard         ← 新建（替换 DonutChartCard）
├── TransactionRankCard      ← 新建
└── TrendInsightRow          ← 保留（数据已更新）
```

**删除的文件/组件：**
- `PeriodTabs.tsx`（功能不再需要）
- `MonthSelector.tsx`（功能合入 AccountSelectorBar）
- `BarChartCard.tsx`（由 DailyTrendCard 替代）
- `DonutChartCard.tsx`（由 CategoryRankCard 替代）

---

## 4. 组件详细设计

### 4.1 AccountSelectorBar

**文件：** `components/stats/AccountSelectorBar.tsx`

**布局：**
```
[我的账本 ▼]                    [‹ 2026年03月 ›]
```

**规格：**
- 整行 `flexDirection: 'row'`，`justifyContent: 'space-between'`，`alignItems: 'center'`
- 左侧账本选择器：胶囊形圆角按钮（`borderRadius: 20`），白色背景，`shadows.sm`，内含文字"我的账本"+ 下箭头 `▼`；`onPress` 为空占位
- 右侧月份导航：`‹` 文字按钮 + 月份文字（`YYYY年MM月`）+ `›` 文字按钮，使用 `colors.text` 色
- 背景透明，`paddingHorizontal: 16`，`paddingVertical: 8`

**Props：**
```ts
interface AccountSelectorBarProps {
  monthLabel: string;       // 如 "2026年03月"
  onPrev: () => void;
  onNext: () => void;
}
```

---

### 4.2 SummaryOverviewCard

**文件：** `components/stats/SummaryOverviewCard.tsx`

**布局：**
```
┌──────────────────────────────────────────┐
│ 收支总览                     🐣（装饰）  │
│ ─────────────────────────────────────── │
│   支出(coral)  收入(sage)   结余(动态)   │
│   ¥566,383    ¥20,000    -¥546,383      │
│ ─────────────────────────────────────── │
│  日均支出      日均收入     日均结余      │
│  ¥24,625      ¥869       -¥23,755      │
│ ─────────────────────────────────────── │
│ 月起始日: 2026年03月01日—2026年03月31日 ⓘ│
└──────────────────────────────────────────┘
```

**数据规格：**
- 日均 = 总额 ÷ 当月已过天数（`min(today.getDate(), daysInMonth)`）
- 结余颜色：正数 → `colors.sage`，负数 → `colors.coral`（日均结余同规则）
- 装饰图标：`Text` emoji `🐣`（占位，后期替换图片资源）
- 日期栏：`月份第一天 — 月份最后一天`，格式 `YYYY年MM月DD日`，末尾 ⓘ 图标（`onPress` 空占位）

**Props：**
```ts
interface SummaryOverviewCardProps {
  totalExpense: number;
  totalIncome: number;
  balance: number;
  avgExpense: number;
  avgIncome: number;
  avgBalance: number;
  dateRangeLabel: string;   // 如 "2026年03月01日—2026年03月31日"
}
```

---

### 4.3 DailyTrendCard

**文件：** `components/stats/DailyTrendCard.tsx`

**布局：**
```
┌──────────────────────────────────────────┐
│ 每日趋势        [支出]  收入  结余        │ ← 右上角维度 Tab
│                                          │
│  [图表区域，高度 160]                    │
│   x轴: 03-01, 03-06, 03-11 ...          │
│                                          │
│          [柱状图]  [折线图]              │ ← 底部图表类型 Tab
└──────────────────────────────────────────┘
```

**数据规格：**
- X 轴：当月每天，label 每 5 天显示一次（1、6、11、16、21、26、末）
- Y 轴：自动缩放，`noOfSections: 4`，隐藏 Y 轴文字（仅显示网格线）
- 维度映射：支出 → `item.expense`，收入 → `item.income`，结余 → `item.income - item.expense`
- 结余负数：柱状图用 `colors.coralLight` 表示负值柱（gifted-charts 负数支持），折线图用红色线
- 图表库：`react-native-gifted-charts`（`BarChart` / `LineChart`），`isAnimated: true`

**内部 State：**
```ts
type Dimension = 'expense' | 'income' | 'balance';
type ChartType = 'bar' | 'line';
// useState: dimension = 'expense', chartType = 'bar'
```

**Props：**
```ts
interface DailyTrendCardProps {
  dailyData: { date: string; expense: number; income: number }[];
  // date 格式: "YYYY-MM-DD"
}
```

**颜色对应：**
| 维度 | 颜色 |
|------|------|
| 支出 | `colors.coral` |
| 收入 | `colors.sage` |
| 结余（正） | `colors.honey` |
| 结余（负） | `colors.coralLight` |

---

### 4.4 CategoryRankCard

**文件：** `components/stats/CategoryRankCard.tsx`

**布局：**
```
┌──────────────────────────────────────────┐
│ 分类排行榜                  [支出] 收入  │
│                                          │
│           ╭───────╮                     │
│           │ 餐饮   │  ← 最大分类名+占比  │
│           │ 98.1%  │                     │
│           ╰───────╯                     │
│                                          │
│ 1  🍴  餐饮   16笔  ████████  -555,774  │
│ 2  💳  转账    1笔  ▏          -10,000  │
│ 3  🥦  买菜    1笔  ▏             -500  │
│                                          │
│              ↓ 查看更多                  │
└──────────────────────────────────────────┘
```

**甜甜圈图规格：**
- `radius: 80`，`innerRadius: 52`，居中显示
- 中心标签：占比最大分类名 + 百分比（`\n` 换行）
- 最多 6 色段，其余合并为"其他"（`colors.creamDeeper`）

**排行列表规格：**
- 每行：序号（灰色小字）+ 分类图标 emoji + 分类名 + 笔数（灰色）+ 比例条 + 金额
- 比例条：`width = (amount / maxAmount) * 120`，高度 4，`borderRadius: 2`，颜色取分类色
- 默认显示前 3 条；展开后显示全部（无上限）
- "查看更多"按钮：`↓ 查看更多`；展开后变为 `↑ 收起`

**支出/收入切换：** 切换后甜甜圈与列表同步刷新，收入模式金额显示正数（`colors.sage`）

**Props：**
```ts
interface CategoryRankCardProps {
  expenseByCategory: CategoryStat[];
  incomeByCategory: CategoryStat[];
}

interface CategoryStat {
  emoji: string;
  name: string;
  amount: number;
  count: number;
  percent: number;
  color: string;
}
```

**内部 State：** `tab: 'expense' | 'income'`，`expanded: boolean`

---

### 4.5 TransactionRankCard

**文件：** `components/stats/TransactionRankCard.tsx`

**布局：**
```
┌──────────────────────────────────────────┐
│ 明细排行榜                  [支出] 收入  │
│                                          │
│ 1  🍴  餐饮                  -555,555   │
│         03月22日                         │
│                                          │
│ 2  💳  转账                   -10,000   │
│         03月07日 · 微信:待杨夫人...      │
│                                          │
│ 3  🥦  买菜                      -500   │
│         03月01日                         │
│                                          │
│              ↓ 查看更多                  │
└──────────────────────────────────────────┘
```

**列表规格：**
- 按金额绝对值降序
- 默认显示前 3 条；展开后显示前 10 条
- 每行：序号 + 分类图标 + 分类名（左） + 金额（右，支出 `colors.coral`，收入 `colors.sage`）
- 次行：日期（`MM月DD日`格式）+ 备注（有则显示，`· 备注内容`，`numberOfLines={1}`，灰色小字）
- "查看更多" / "↑ 收起" 同 CategoryRankCard

**Props：**
```ts
interface TransactionRankCardProps {
  expenseTransactions: RankedTransaction[];
  incomeTransactions: RankedTransaction[];
}

interface RankedTransaction {
  id: string;
  categoryEmoji: string;
  categoryName: string;
  amount: number;
  date: string;    // "YYYY-MM-DD"
  note?: string;
}
```

**内部 State：** `tab: 'expense' | 'income'`，`expanded: boolean`

---

## 5. stats.tsx 改动范围

### 新增数据计算

```ts
// 日维度数据（全月每天）
const dailyData = useMemo(() => { /* 按日聚合 expense/income */ }, [filtered]);

// 分类统计（支出 + 收入分开）
const expenseByCat = useMemo(() => { /* ... */ }, [filtered, categoryMap]);
const incomeByCat  = useMemo(() => { /* ... */ }, [filtered, categoryMap]);

// 明细排行（支出 + 收入分开，按绝对值降序）
const expenseRank = useMemo(() => { /* ... */ }, [filtered, categoryMap]);
const incomeRank  = useMemo(() => { /* ... */ }, [filtered, categoryMap]);

// 日均计算
const daysElapsed = useMemo(() => { /* min(today, monthEnd) 已过天数 */ }, [currentDate]);
const avgExpense = totalExpense / daysElapsed;
const avgIncome  = totalIncome  / daysElapsed;
const avgBalance = balance / daysElapsed;
```

### 删除
- `weeklyData` 计算逻辑
- `categoryData` 计算逻辑（由新的 `expenseByCat` 替代）
- `WEEKLY_LABELS` 常量

---

## 6. 不在本次范围内

- 账本切换功能（多账本数据层）
- 查看更多跳转至明细页
- 装饰插画资源替换（当前用 emoji 占位）
- AI 洞察真实数据接入（当前为静态数据）

---

## 7. 受影响文件清单

| 文件 | 操作 |
|------|------|
| `app/(tabs)/stats.tsx` | 修改（替换 JSX，新增数据计算） |
| `components/stats/AccountSelectorBar.tsx` | 新建 |
| `components/stats/SummaryOverviewCard.tsx` | 新建 |
| `components/stats/DailyTrendCard.tsx` | 新建 |
| `components/stats/CategoryRankCard.tsx` | 新建 |
| `components/stats/TransactionRankCard.tsx` | 新建 |
| `components/stats/PeriodTabs.tsx` | 删除 |
| `components/stats/MonthSelector.tsx` | 删除 |
| `components/stats/BarChartCard.tsx` | 删除 |
| `components/stats/DonutChartCard.tsx` | 删除 |
| `components/stats/TrendInsightRow.tsx` | 保留（数据已更新） |

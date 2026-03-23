# 日记页 UX 修复与增强设计

## 概述

针对日记页 5 个问题的修复设计：卡片固定、预算设置入口、结余计算 bug、预算未设置提示、数据刷新。

---

## 1. 卡片固定

**问题**：`diary.tsx` 把 HeaderGreeting + OverviewCard + 交易列表全部放在同一个 ScrollView 中，导致卡片随列表一起滚动。

**方案**：拆分布局，将 HeaderGreeting 和 OverviewCard 提到 ScrollView 外面作为固定头部，交易列表改用 FlatList 独立滚动。

**改动文件**：`apps/mobile/app/(tabs)/diary.tsx`

**结构变化**：
```
View (flex:1)
  ├─ HeaderGreeting        ← 固定
  ├─ OverviewCard          ← 固定
  └─ FlatList              ← 只有交易列表滚动
       └─ DayGroup[]
```

**FlatList 数据设计**：`data` 为 `DayData[]`，每个 `renderItem` 渲染一个完整的 `DayGroup`（含其内部的 `TransactionItem[]`）。不做扁平化处理，保持现有的 DayGroup 嵌套结构。

---

## 2. 结余显示 bug

**问题**：`fmt()` 函数使用 `Math.abs(amount)`，将负数结余显示为正数。当收入=0、支出=1,154,107 时，结余=-1,154,107 但显示为 ¥1,154,107。

**方案**：
- `fmt()` 改为：负数时返回 `-¥X`，正数时返回 `¥X`
- OverviewCard 中结余颜色动态化：正数/零用 `colors.sage`（绿），负数用 `colors.coral`（红）
- `computeStats` 新增返回 `balanceRaw: number`（原始数值），传给 OverviewCard 用于颜色判断

**改动文件**：`diary.tsx`（fmt 函数 + computeStats 返回值）、`OverviewCard.tsx`（颜色逻辑）

---

## 3. 本月预算设置入口

**问题**：OverviewCard 的"本月预算"是纯展示，无法点击进入设置。

**方案**：
- `computeStats` 新增返回 `hasBudget: boolean`（`monthlyBudget !== undefined`）
- OverviewCard 的"本月预算" Cell 接收 `onPressBudget` 回调，整个 Cell 可点击
- 未设置时值显示"点击设置"，颜色用 `colors.textLighter`

**新建页面** `apps/mobile/app/budget-setting.tsx`：
- 路由方式：`router.push('/budget-setting')`，与 `manual-entry.tsx` 一致（均为 `<Slot />` 下的普通页面跳转，不需要修改 `_layout.tsx`）
- Header：标题"设置本月预算" + 返回按钮
- 金额输入框：¥ 前缀 + 数字键盘
- 保存按钮

**逻辑**：
- 打开时查询现有月度预算（`period='monthly'` + `category_id IS NULL`），有则回填金额（编辑模式）
- 保存：无现有记录 → `useCreateBudget`；有 → 新增 `useUpdateBudget`
- 预算属性：`period: 'monthly'`、`category_id: null`（全局）、`start_date` 为当月 1 号

**改动文件**：`diary.tsx`、`OverviewCard.tsx`、新建 `budget-setting.tsx`、`useLocalBudgets.ts`（新增 useUpdateBudget）、`packages/shared/src/types/budget.ts`（新增 UpdateBudgetInput 类型）

---

## 4. 预算未设置时联动显示

**问题**：未设置预算时显示 ¥0，缺乏引导。

**方案**：

**传值策略**：`computeStats` 正常计算所有值。`hasBudget` 标志传给 OverviewCard，由 OverviewCard 在渲染层覆盖显示。

当 `hasBudget === false` 时：

| 字段 | hasBudget=true | hasBudget=false |
|------|---------------|-----------------|
| 本月预算 | ¥5,000 | 点击设置 |
| 月剩余 | ¥3,200 | -- |
| 剩余日均 | ¥400 | -- |
| 剩余日均子标签 | 还剩X天 | 还剩X天（保留，仍有参考意义） |
| 进度条 | 正常显示 | 隐藏 |

月剩余、剩余日均无预算基准时无意义，显示 `--`。"还剩X天"子标签保留，因为它表示月内剩余天数，独立于预算。

**改动文件**：`OverviewCard.tsx`

---

## 5. 日记页切回刷新数据

**问题**：
1. `diary.tsx` 缺少 `useFocusEffect`，从其他页面切回时不刷新数据
2. `useLocalTransactions` 默认 `LIMIT 20`，可能截断历史记录

**方案**：
1. `diary.tsx` 添加 `useFocusEffect` + `refetch`（与 index.tsx:138 一致）
2. 新增 `useMonthlyTransactions(year, month)` hook，按当月过滤无分页查询：
   ```sql
   SELECT * FROM transactions
   WHERE deleted_at IS NULL AND occurred_at >= '当月1号'
   ORDER BY occurred_at DESC
   ```
   queryKey 为 `["transactions", "monthly", "2026-03"]`，与现有 `["transactions", page]` 不冲突。日记页改用此 hook。

**行为变化说明**：改为只查当月数据后，日记页将不再显示上月交易。这是期望行为——日记页聚焦当月记录，历史数据可通过统计页/账单页查看。

**改动文件**：`diary.tsx`、`useLocalTransactions.ts`（新增 useMonthlyTransactions）

---

## 改动文件汇总

| 文件 | 改动类型 |
|------|---------|
| `apps/mobile/app/(tabs)/diary.tsx` | 布局重构 + fmt 修复 + useFocusEffect + hasBudget |
| `apps/mobile/components/shared/OverviewCard.tsx` | 颜色动态化 + onPressBudget + hasBudget 联动 |
| `apps/mobile/app/budget-setting.tsx` | 新建：预算设置页 |
| `apps/mobile/hooks/useLocalBudgets.ts` | 新增 useUpdateBudget |
| `apps/mobile/hooks/useLocalTransactions.ts` | 新增 useMonthlyTransactions |
| `packages/shared/src/types/budget.ts` | 新增 UpdateBudgetInput 类型 |

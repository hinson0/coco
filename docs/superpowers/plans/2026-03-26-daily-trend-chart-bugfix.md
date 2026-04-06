# DailyTrendCard 结余模式渲染 Bug 修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复"结余"维度下图表渲染溢出和日期标签位置错误的 bug

**Architecture:** 统一正负方向的 stepValue，用 TOTAL_PX / totalSections 计算 pxPerSection 保证总高度恒定，同时使用库原生 `xAxisLabelsAtBottom` prop 把标签推到底部

**Tech Stack:** React Native, react-native-gifted-charts 1.4.76 (gifted-charts-core 0.1.80)

---

### Task 1: 修复 BarChart 结余模式渲染

**Files:**
- Modify: `apps/mobile/components/stats/DailyTrendCard.tsx:93-148` (Y 轴计算逻辑)
- Modify: `apps/mobile/components/stats/DailyTrendCard.tsx:218-243` (BarChart props)

- [ ] **Step 1: 替换 Y 轴计算逻辑**

将 `DailyTrendCard.tsx` 第 93-148 行的计算逻辑替换为：

```tsx
  const values = useMemo(
    () => dailyData.map((d) => getDimensionValue(d, dimension)),
    [dailyData, dimension],
  );

  const activeColor = DIMENSION_COLORS[dimension];
  const maxPos = Math.max(...values, 0);
  const minNeg = Math.min(...values, 0);
  const absNeg = Math.abs(minNeg);
  const hasNeg = minNeg < 0;

  // 统一 step：取正负最大绝对值，均匀分 5 格
  const TOTAL_PX = 200;
  const NUM_SECTIONS = 5;
  const maxAbs = Math.max(maxPos, absNeg, 1);
  const stepValue = Math.ceil(maxAbs / NUM_SECTIONS);

  const sectionsAbove = Math.max(1, Math.ceil(maxPos / stepValue));
  const sectionsBelow = hasNeg ? Math.max(1, Math.ceil(absNeg / stepValue)) : 0;
  const totalSections = sectionsAbove + sectionsBelow;

  // 按比例分配像素：每格等高，总高度恒定 TOTAL_PX
  const pxPerSection = Math.round(TOTAL_PX / totalSections);
  const positiveHeight = pxPerSection * sectionsAbove;
```

关键变化：
- `stepValue` 统一（正负共享），不再有 `posStep` / `negStep` 之分
- `pxPerSection` 由 `TOTAL_PX / totalSections` 得出，保证图表总高度 ~200px
- `positiveHeight` 按实际 sections 比例分配

- [ ] **Step 2: 更新 BarChart props**

将 BarChart 组件的 props 改为：

```tsx
        <BarChart
          data={barData}
          height={positiveHeight}
          barWidth={BAR_WIDTH}
          barBorderRadius={3}
          noOfSections={sectionsAbove}
          stepValue={stepValue}
          yAxisTextStyle={yAxisTextStyle}
          formatYLabel={formatYLabel}
          yAxisLabelWidth={Y_AXIS_WIDTH}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={colors.creamDark}
          rulesColor={colors.creamDark}
          dashGap={4}
          dashWidth={3}
          backgroundColor={colors.white}
          xAxisLabelTextStyle={xAxisTextStyle}
          initialSpacing={INITIAL_SPACING}
          spacing={barSpacing}
          noOfSectionsBelowXAxis={sectionsBelow}
          negativeStepHeight={pxPerSection}
          autoShiftLabels
          xAxisLabelsAtBottom
          endSpacing={END_SPACING}
        />
```

关键变化：
- **移除** `negativeStepValue`（默认回退到 `stepValue`，即统一 step）
- **保留** `negativeStepHeight={pxPerSection}`（等于正方向的 stepHeight，保证等比渲染）
- **新增** `xAxisLabelsAtBottom`（把日期标签推到负值区域底部）

- [ ] **Step 3: 验证 BarChart 渲染**

在模拟器中检查：
1. 切到"结余"维度，柱子正确渲染（正值向上、负值向下，无溢出）
2. 日期标签在图表底部而非零线处
3. 切到"支出"/"收入"，无回归（sectionsBelow=0 时行为不变）

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/stats/DailyTrendCard.tsx
git commit -m "fix: BarChart 结余模式渲染溢出和标签位置"
```

---

### Task 2: 修复 LineChart 结余模式渲染

**Files:**
- Modify: `apps/mobile/components/stats/DailyTrendCard.tsx:244-270` (LineChart props)

- [ ] **Step 1: 更新 LineChart props**

将 LineChart 组件的 props 改为：

```tsx
        <LineChart
          data={lineData}
          height={positiveHeight}
          noOfSections={sectionsAbove}
          stepValue={stepValue}
          yAxisTextStyle={yAxisTextStyle}
          formatYLabel={formatYLabel}
          yAxisLabelWidth={Y_AXIS_WIDTH}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={colors.creamDark}
          rulesColor={colors.creamDark}
          dashGap={4}
          dashWidth={3}
          color={activeColor}
          xAxisLabelTextStyle={xAxisTextStyle}
          initialSpacing={INITIAL_SPACING}
          spacing={barSpacing}
          dataPointsColor={activeColor}
          dataPointsRadius={3}
          noOfSectionsBelowXAxis={sectionsBelow}
          negativeStepHeight={pxPerSection}
          xAxisLabelsAtBottom
          labelsExtraHeight={28}
          endSpacing={20}
        />
```

关键变化（与 BarChart 对称）：
- **移除** `negativeStepValue`
- **保留** `negativeStepHeight={pxPerSection}`
- **新增** `xAxisLabelsAtBottom`

- [ ] **Step 2: 验证 LineChart 渲染**

在模拟器中检查：
1. 切到"折线图" + "结余"，折线正确穿越零线，无溢出
2. 日期标签在底部
3. "支出"/"收入"折线图无回归

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/stats/DailyTrendCard.tsx
git commit -m "fix: LineChart 结余模式渲染溢出和标签位置"
```

---

### Task 3: 清理冗余代码

**Files:**
- Modify: `apps/mobile/components/stats/DailyTrendCard.tsx:156-157` (negLabelStyle)

- [ ] **Step 1: 移除 negLabelStyle**

`xAxisLabelsAtBottom` 让标签始终在底部后，负值柱子的标签不再被 180° 旋转到零线上方。移除不再需要的反旋转逻辑。

删除：
```tsx
  // 负值柱子的标签被库旋转 180°，用反向旋转抵消
  const negLabelStyle = { ...xAxisTextStyle, transform: [{ rotate: '180deg' }] as const };
```

更新 `barData` 的 `labelTextStyle`，统一使用 `xAxisTextStyle`：

```tsx
  const barData = values.map((v, i) => {
    const day = parseInt(dailyData[i].date.slice(8), 10);
    const showLabel = shouldShowLabel(day);
    return {
      value: v,
      frontColor: v < 0 ? colors.coralLight : activeColor,
      label: showLabel ? dailyData[i].date.slice(5) : "",
      labelTextStyle: showLabel ? xAxisTextStyle : undefined,
      labelWidth: showLabel ? 30 : undefined,
    };
  });
```

**注意：** 如果 `xAxisLabelsAtBottom` 未能完全消除旋转问题（验证 Task 1 Step 3 时确认），则保留 `negLabelStyle`，跳过此步。

- [ ] **Step 2: 验证清理后无回归**

在模拟器中快速切换所有维度 + 图表类型组合（6 种），确认标签文字方向正确。

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/stats/DailyTrendCard.tsx
git commit -m "refactor: 移除结余标签反旋转 workaround"
```

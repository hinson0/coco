# DailyTrendCard 结余模式渲染 Bug 修复

## 问题描述

"结余"维度下，当负值远大于正值时（如正值 1.0，负值 -65.5w），图表渲染严重异常：
1. **柱子溢出** — 手动像素分配逻辑与库内部计算冲突，负值柱子渲染为溢出的细线
2. **日期标签位置错误** — `noOfSectionsBelowXAxis > 0` 时，库将 X 轴画在零线位置，日期标签跑到图表中间而非底部

"支出"和"收入"维度不受影响（纯正值，无负值区域）。

## 根因

当前代码过度手动控制像素分配：
- `positiveHeight`、`negSectionHeight` 手动计算，与库的内部布局引擎冲突
- 正负方向使用不同的 step（`posStep` vs `negStep`），导致比例失调
- 传入 `negativeStepHeight` 覆盖库的自动计算，在极端比例下产生溢出

## 修复方案

### Bug 1：统一 step，简化负值处理

**删除**手动像素分配逻辑，改为统一 step 让库自动管理：

```
maxAbs = max(maxPos, absNeg, 1)
stepValue = ceil(maxAbs / 5)
sectionsAbove = max(1, ceil(maxPos / stepValue))
sectionsBelow = hasNeg ? max(1, ceil(absNeg / stepValue)) : 0
```

传给 BarChart / LineChart：
- `height` = 固定 200（正方向高度，库自动按比例计算负方向高度）
- `stepValue` = 统一的 step
- `noOfSections` = `sectionsAbove`
- `noOfSectionsBelowXAxis` = `sectionsBelow`
- **移除** `negativeStepValue` 和 `negativeStepHeight`

### Bug 2：日期标签始终在底部

优先尝试 `xAxisLabelsVerticalShift` prop 将标签下推到负值区域底部。

降级方案：如果库不支持或效果不佳，改为不传 `label` 给 barData，在图表下方自行渲染一行日期标签 `<View>`。

## 涉及文件

- `apps/mobile/components/stats/DailyTrendCard.tsx` — 唯一需要修改的文件

## 不变的部分

- 维度切换（支出/收入/结余）逻辑
- 图表类型切换（柱状图/折线图）
- X 轴标签筛选逻辑（day 1, 6, 11, 16, 21, 26, last）
- Y 轴格式化（k/w 单位）
- 颜色方案、spacing 计算
- `statsUtils.ts` 数据处理逻辑

## 验收标准

1. "结余"模式下柱子正常渲染，正值向上、负值向下
2. 极端数据（正值 ~0，负值 -65w）不溢出
3. 日期标签始终在图表底部
4. "支出"/"收入"模式无回归
5. 柱状图和折线图都正常

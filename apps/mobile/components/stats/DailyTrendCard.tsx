import { useCallback, useMemo, useState } from "react";
import {
  type GestureResponderEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { colors, shadows } from "../../constants/theme";
import { getDimensionValue, type DailyDataPoint } from "../../utils/statsUtils";
import { AppText } from "../ui/AppText";
import { Card } from "../ui/Card";

export type Dimension = "expense" | "income" | "balance";

const DIMENSION_LABELS: Record<Dimension, string> = {
  expense: "支出",
  income: "收入",
  balance: "结余",
};
const DIMENSION_COLORS: Record<Dimension, string> = {
  expense: colors.coral,
  income: colors.sage,
  balance: colors.honey,
};

interface DailyTrendCardProps {
  readonly dailyData: DailyDataPoint[];
  readonly dimension: Dimension;
  readonly onDimensionChange: (d: Dimension) => void;
}

function DimensionTab({
  active,
  dim,
  onPress,
}: {
  active: Dimension;
  dim: Dimension;
  onPress: () => void;
}) {
  const isActive = active === dim;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.dimTab,
        isActive && { backgroundColor: DIMENSION_COLORS[dim] },
      ]}
    >
      <AppText
        size="sm"
        weight="semibold"
        color={isActive ? colors.white : colors.textLighter}
      >
        {DIMENSION_LABELS[dim]}
      </AppText>
    </Pressable>
  );
}

// Card padding(16)*2 + screen horizontal padding (estimated 32)
const HORIZONTAL_OVERHEAD = 64;
const Y_AXIS_WIDTH = 45;
const BAR_WIDTH = 6;
const INITIAL_SPACING = 8;
const TOTAL_PX = 200;
const NUM_SECTIONS = 5;
const END_SPACING = 4;
const TOOLTIP_WIDTH = 120;

export function DailyTrendCard({ dailyData, dimension, onDimensionChange }: DailyTrendCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const values = useMemo(
    () => dailyData.map((d) => getDimensionValue(d, dimension)),
    [dailyData, dimension],
  );

  const activeColor = DIMENSION_COLORS[dimension];
  const maxPos = Math.max(...values, 0);
  const minNeg = Math.min(...values, 0);
  const absNeg = Math.abs(minNeg);
  const hasNeg = minNeg < 0;

  const maxAbs = Math.max(maxPos, absNeg, 1);
  const stepValue = Math.ceil(maxAbs / NUM_SECTIONS);

  const sectionsAbove = Math.max(1, Math.ceil(maxPos / stepValue));
  const sectionsBelow = hasNeg ? Math.max(1, Math.ceil(absNeg / stepValue)) : 0;
  const totalSections = sectionsAbove + sectionsBelow;

  // 按比例分配像素：每格等高，总高度恒定 TOTAL_PX
  const pxPerSection = Math.round(TOTAL_PX / totalSections);
  const positiveHeight = pxPerSection * sectionsAbove;

  // 动态计算 spacing，让数据点刚好铺满可用宽度
  const chartAreaWidth =
    screenWidth - HORIZONTAL_OVERHEAD - Y_AXIS_WIDTH - END_SPACING;
  const numBars = dailyData.length || 1;
  const barSpacing = Math.max(
    1,
    Math.floor((chartAreaWidth - INITIAL_SPACING) / numBars - BAR_WIDTH),
  );

  // x-axis labels: day 1, 6, 11, 16, 21, 26, and last day
  const shouldShowLabel = (day: number) =>
    day === 1 || (day - 1) % 5 === 0 || day === dailyData.length;

  const yAxisTextStyle = { color: colors.textLighter, fontSize: 9 };

  const pointStep = BAR_WIDTH + barSpacing;
  const handleChartPress = useCallback(
    (e: GestureResponderEvent) => {
      const x = e.nativeEvent.locationX - INITIAL_SPACING - BAR_WIDTH / 2;
      const idx = Math.round(x / pointStep);
      const clamped = Math.max(0, Math.min(idx, numBars - 1));
      setSelectedIndex((prev) => (prev === clamped ? null : clamped));
    },
    [pointStep, numBars],
  );

  const lineData = values.map((v) => ({
    value: v,
    dataPointColor: activeColor,
  }));

  const formatYLabel = (v: string) => {
    const raw = Number(v);
    const sign = raw < 0 ? "-" : "";
    const n = Math.abs(raw);
    if (n >= 10000)
      return `${sign}${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}w`;
    if (n >= 1000)
      return `${sign}${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return v;
  };

  const handleDimensionChange = (d: Dimension) => {
    onDimensionChange(d);
    setSelectedIndex(null);
  };

  // Tooltip 内容
  const tooltipPoint = selectedIndex !== null ? dailyData[selectedIndex] : null;
  const tooltipValue =
    tooltipPoint != null ? getDimensionValue(tooltipPoint, dimension) : 0;
  const tooltipLeft =
    selectedIndex !== null
      ? selectedIndex * (BAR_WIDTH + barSpacing) +
        BAR_WIDTH / 2 -
        TOOLTIP_WIDTH / 2
      : 0;

  return (
    <Card radius="lg" shadow="md" padding={16}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleAccent} />
          <AppText size="lg" weight="semibold" color={colors.text}>
            每日趋势
          </AppText>
        </View>
        <View style={styles.dimTabs}>
          {(["expense", "income", "balance"] as const).map((d) => (
            <DimensionTab
              key={d}
              active={dimension}
              dim={d}
              onPress={() => handleDimensionChange(d)}
            />
          ))}
        </View>
      </View>

      {/* Chart + tooltip overlay */}
      <View style={styles.chartWrapper}>
        {/* Tooltip + vertical indicator — absolute overlay, does not affect layout */}
        {tooltipPoint != null && selectedIndex !== null && (
          <>
            <View style={[styles.tooltipPositioner, { left: tooltipLeft }]}>
              <View style={styles.tooltip}>
                <AppText size="sm" weight="semibold" color={colors.text}>
                  {tooltipPoint.date.slice(5)}
                </AppText>
                <AppText size="sm" color={colors.text}>
                  {DIMENSION_LABELS[dimension]}: ¥
                  {tooltipValue.toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </AppText>
              </View>
            </View>
            <View
              style={[
                styles.stripLine,
                {
                  left: selectedIndex * (BAR_WIDTH + barSpacing) + BAR_WIDTH / 2,
                  height: positiveHeight + sectionsBelow * pxPerSection,
                },
              ]}
            />
          </>
        )}

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
          initialSpacing={INITIAL_SPACING + BAR_WIDTH / 2}
          spacing={BAR_WIDTH + barSpacing}
          dataPointsColor={activeColor}
          dataPointsRadius={3}
          noOfSectionsBelowXAxis={sectionsBelow}
          endSpacing={END_SPACING}
          disableScroll
        />
        {/* 自定义触摸层：替代库的 focusEnabled，解决负值区域触摸检测失灵 */}
        <Pressable
          onPress={handleChartPress}
          style={[
            styles.touchOverlay,
            {
              height: positiveHeight + sectionsBelow * pxPerSection,
            },
          ]}
        />
      </View>

      {/* X-axis date labels — rendered outside chart to avoid negative-area positioning issues */}
      <View style={styles.xAxisLabels}>
        {dailyData.map((d, i) => {
          const day = parseInt(d.date.slice(8), 10);
          if (!shouldShowLabel(day)) return null;
          const left = i * (BAR_WIDTH + barSpacing) + BAR_WIDTH / 2 - 15;
          return (
            <View key={d.date} style={[styles.xAxisLabelItem, { left }]}>
              <AppText size="xs" color={colors.textLighter}>
                {d.date.slice(5)}
              </AppText>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  titleAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.honey,
  },
  dimTabs: {
    flexDirection: "row",
    gap: 4,
  },
  dimTab: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  chartWrapper: {
    position: "relative",
  },
  tooltipPositioner: {
    position: "absolute",
    top: 0,
    marginLeft: Y_AXIS_WIDTH + INITIAL_SPACING,
    width: TOOLTIP_WIDTH,
    alignItems: "center" as const,
    zIndex: 10,
  },
  tooltip: {
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.creamDark,
    ...shadows.md,
  },
  touchOverlay: {
    position: "absolute",
    top: 0,
    left: Y_AXIS_WIDTH,
    right: 0,
    zIndex: 8,
  },
  stripLine: {
    position: "absolute",
    top: 0,
    marginLeft: Y_AXIS_WIDTH + INITIAL_SPACING,
    width: 1,
    backgroundColor: colors.textLighter,
    opacity: 0.4,
    zIndex: 5,
  },
  xAxisLabels: {
    position: "relative",
    marginLeft: Y_AXIS_WIDTH + INITIAL_SPACING,
    height: 16,
    marginTop: 4,
  },
  xAxisLabelItem: {
    position: "absolute",
    width: 30,
    alignItems: "center",
  },
});

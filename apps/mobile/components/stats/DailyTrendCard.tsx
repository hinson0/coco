import { useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { colors } from "../../constants/theme";
import { getDimensionValue, type DailyDataPoint } from "../../utils/statsUtils";
import { AppText } from "../ui/AppText";
import { Card } from "../ui/Card";

type Dimension = "expense" | "income" | "balance";
type ChartType = "bar" | "line";

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

function ChartTypeTab({
  active,
  type,
  onPress,
}: {
  active: ChartType;
  type: ChartType;
  onPress: () => void;
}) {
  const isActive = active === type;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chartTab, isActive && styles.chartTabActive]}
    >
      <AppText
        size="sm"
        weight="semibold"
        color={isActive ? colors.text : colors.textLighter}
      >
        {type === "bar" ? "柱状图" : "折线图"}
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
const END_SPACING = 20;

export function DailyTrendCard({ dailyData }: DailyTrendCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [dimension, setDimension] = useState<Dimension>("expense");
  const [chartType, setChartType] = useState<ChartType>("bar");

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

  // 动态计算 spacing，让柱子刚好铺满可用宽度
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

  const barData = values.map((v) => ({
    value: v,
    frontColor: v < 0 ? colors.coralLight : activeColor,
  }));

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
              onPress={() => setDimension(d)}
            />
          ))}
        </View>
      </View>

      {/* Chart */}
      {chartType === "bar" ? (
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
          initialSpacing={INITIAL_SPACING}
          spacing={barSpacing}
          noOfSectionsBelowXAxis={sectionsBelow}
          negativeStepHeight={pxPerSection}
          endSpacing={END_SPACING}
        />
      ) : (
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
        />
      )}

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

      {/* Chart type toggle */}
      <View style={styles.chartTypeTabs}>
        <ChartTypeTab
          active={chartType}
          type="bar"
          onPress={() => setChartType("bar")}
        />
        <ChartTypeTab
          active={chartType}
          type="line"
          onPress={() => setChartType("line")}
        />
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
  chartTypeTabs: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  chartTab: {
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  chartTabActive: {
    backgroundColor: colors.honeyPale,
  },
});

import { useState, useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';
import { getDimensionValue, type DailyDataPoint } from '../../utils/statsUtils';

type Dimension = 'expense' | 'income' | 'balance';
type ChartType = 'bar' | 'line';

const DIMENSION_LABELS: Record<Dimension, string> = {
  expense: '支出',
  income: '收入',
  balance: '结余',
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
  active, dim, onPress,
}: {
  active: Dimension; dim: Dimension; onPress: () => void;
}) {
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

function ChartTypeTab({
  active, type, onPress,
}: {
  active: ChartType; type: ChartType; onPress: () => void;
}) {
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
  const maxAbsValue = Math.max(...values.map(Math.abs), 1);
  const stepValue = Math.ceil(maxAbsValue / 4);

  // x-axis labels: day 1, 6, 11, 16, 21, 26, and last day
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
          stepValue={stepValue}
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
          {...(hasNegative ? { negativeStepValue: stepValue, yAxisOffset: 0 } : {})}
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
        <ChartTypeTab active={chartType} type="bar" onPress={() => setChartType('bar')} />
        <ChartTypeTab active={chartType} type="line" onPress={() => setChartType('line')} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dimTabs: {
    flexDirection: 'row',
    gap: 4,
  },
  dimTab: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  chartTypeTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  chartTab: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.creamDark,
  },
  chartTabActive: {
    backgroundColor: colors.white,
    shadowColor: '#3a3028',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
});

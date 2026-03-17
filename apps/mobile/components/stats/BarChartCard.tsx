import { View, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';

interface BarDataPoint {
  readonly label: string;
  readonly expense: number;
  readonly income: number;
}

interface BarChartCardProps {
  readonly data: BarDataPoint[];
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText size="sm" color={colors.textLighter}>{label}</AppText>
    </View>
  );
}

export function BarChartCard({ data }: BarChartCardProps) {
  // Build barData for grouped bars: expense bar followed by income bar per group
  const barData = data.flatMap((item, index) => [
    {
      value: item.expense,
      frontColor: colors.coralLight,
      label: item.label,
      spacing: 4,
      barWidth: 14,
      barBorderRadius: 4,
    },
    {
      value: item.income,
      frontColor: colors.sageLight,
      spacing: index < data.length - 1 ? 20 : 4,
      barWidth: 14,
      barBorderRadius: 4,
    },
  ]);

  return (
    <Card radius="lg" shadow="md" padding={16}>
      <View style={styles.header}>
        <AppText size="lg" weight="semibold" color={colors.text}>每周对比</AppText>
        <View style={styles.legend}>
          <LegendDot color={colors.coralLight} label="支出" />
          <LegendDot color={colors.sageLight} label="收入" />
        </View>
      </View>
      <BarChart
        data={barData}
        barWidth={14}
        spacing={20}
        roundedTop
        isAnimated
        noOfSections={4}
        height={120}
        yAxisTextStyle={styles.axisText}
        xAxisLabelTextStyle={styles.axisText}
        hideYAxisText
        hideAxesAndRules={false}
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor={colors.creamDark}
        rulesColor={colors.creamDark}
        backgroundColor={colors.white}
        disableScroll={false}
        initialSpacing={10}
      />
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
  legend: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  axisText: {
    color: colors.textLighter,
    fontSize: 9,
  },
});

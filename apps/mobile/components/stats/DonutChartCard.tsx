import { View, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';

interface CategoryDataItem {
  readonly emoji: string;
  readonly name: string;
  readonly amount: number;
  readonly percent: number;
  readonly color: string;
}

interface DonutChartCardProps {
  readonly data: CategoryDataItem[];
  readonly total: string;
}

export function DonutChartCard({ data, total }: DonutChartCardProps) {
  const pieData = data.map((item) => ({
    value: item.percent,
    color: item.color,
  }));

  return (
    <Card radius="lg" shadow="md" padding={16}>
      <AppText size="lg" weight="semibold" color={colors.text} style={styles.title}>
        支出分类
      </AppText>
      <View style={styles.row}>
        <PieChart
          data={pieData}
          donut
          radius={55}
          innerRadius={35}
          centerLabelComponent={() => (
            <AppText size="sm" weight="bold" color={colors.text}>{total}</AppText>
          )}
        />
        <View style={styles.categoryList}>
          {data.map((item) => (
            <View key={item.name} style={styles.categoryRow}>
              <View style={[styles.iconBox, { backgroundColor: item.color + '33' }]}>
                <AppText size="lg">{item.emoji}</AppText>
              </View>
              <View style={styles.categoryInfo}>
                <AppText size="lg" weight="semibold" color={colors.text}>{item.name}</AppText>
                <AppText size="sm" color={colors.textLighter}>{item.percent}%</AppText>
              </View>
              <AppText size="md" weight="semibold" color={colors.text}>¥{item.amount.toFixed(0)}</AppText>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  categoryList: {
    flex: 1,
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
});

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

import { useState, useMemo, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';
import type { CategoryStat } from '../../utils/statsUtils';

interface CategoryRankCardProps {
  readonly expenseByCategory: CategoryStat[];
  readonly incomeByCategory: CategoryStat[];
}

const MAX_BAR_WIDTH = 120;

export function CategoryRankCard({ expenseByCategory, incomeByCategory }: CategoryRankCardProps) {
  const [tab, setTab] = useState<'expense' | 'income'>('expense');
  const [expanded, setExpanded] = useState(false);

  const data = tab === 'expense' ? expenseByCategory : incomeByCategory;
  const maxAmt = data[0]?.amount ?? 1;
  const top = data[0];
  const visible = expanded ? data : data.slice(0, 3);

  const pieData = useMemo(
    () => data.map((c) => ({ value: c.percent, color: c.color })),
    [data],
  );

  const centerLabel = useCallback(() => {
    if (!top) return null;
    return (
      <View style={styles.centerLabel}>
        <AppText size="sm" weight="bold" color={colors.text}>
          {top.name}
        </AppText>
        <AppText size="sm" color={colors.textLighter}>
          {top.percent}%
        </AppText>
      </View>
    );
  }, [top]);

  return (
    <Card radius="lg" shadow="md" padding={16}>
      {/* Header */}
      <View style={styles.header}>
        <AppText size="lg" weight="semibold" color={colors.text}>分类排行榜</AppText>
        <View style={styles.tabs}>
          {(['expense', 'income'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setTab(t);
                setExpanded(false);
              }}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <AppText size="sm" weight="semibold" color={tab === t ? colors.white : colors.textLighter}>
                {t === 'expense' ? '支出' : '收入'}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Donut chart */}
      {data.length > 0 ? (
        <View style={styles.donutWrap}>
          <PieChart
            data={pieData}
            donut
            radius={80}
            innerRadius={52}
            centerLabelComponent={centerLabel}
          />
        </View>
      ) : (
        <AppText size="xl" color={colors.textLighter} style={styles.empty}>
          暂无数据
        </AppText>
      )}

      {/* Color legend */}
      {data.length > 0 && (
        <View style={styles.legend}>
          {data.map((item) => (
            <View key={`legend-${item.name}-${tab}`} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <AppText size="xs" color={colors.textLight}>
                {item.name} {item.percent}%
              </AppText>
            </View>
          ))}
        </View>
      )}

      {/* Rank list */}
      <View style={styles.list}>
        {visible.map((item, index) => (
          <View key={`${item.name}-${tab}`} style={styles.rankRow}>
            <AppText size="sm" color={colors.textLighter} style={styles.rankNum}>
              {index + 1}
            </AppText>
            <AppText size="xl" style={styles.emoji}>
              {item.emoji}
            </AppText>
            <View style={styles.info}>
              <AppText size="md" weight="semibold" color={colors.text}>
                {item.name}
              </AppText>
              <AppText size="sm" color={colors.textLighter}>
                {item.count}笔
              </AppText>
            </View>
            <View style={styles.barWrap}>
              <View
                style={[
                  styles.bar,
                  {
                    width: (item.amount / maxAmt) * MAX_BAR_WIDTH,
                    backgroundColor: item.color,
                  },
                ]}
              />
            </View>
            <AppText
              size="sm"
              weight="semibold"
              color={tab === 'expense' ? colors.coral : colors.sage}
            >
              {tab === 'expense' ? '-' : '+'}¥{item.amount.toLocaleString('zh-CN', {
                maximumFractionDigits: 0,
              })}
            </AppText>
          </View>
        ))}
      </View>

      {/* Expand toggle */}
      {data.length > 3 && (
        <Pressable onPress={() => setExpanded(!expanded)} style={styles.expandBtn}>
          <AppText size="sm" color={colors.textLighter}>
            {expanded ? '↑ 收起' : '↓ 查看更多'}
          </AppText>
        </Pressable>
      )}
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.creamDark,
    borderRadius: 12,
    padding: 2,
  },
  tab: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.coral,
  },
  donutWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  centerLabel: {
    alignItems: 'center',
  },
  empty: {
    textAlign: 'center',
    marginVertical: 20,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  list: {
    gap: 10,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankNum: {
    width: 16,
    textAlign: 'center',
  },
  emoji: {
    width: 28,
    textAlign: 'center',
  },
  info: {
    width: 56,
  },
  barWrap: {
    flex: 1,
  },
  bar: {
    height: 4,
    borderRadius: 2,
  },
  expandBtn: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 4,
  },
});

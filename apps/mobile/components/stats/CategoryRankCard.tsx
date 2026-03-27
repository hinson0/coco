import { useState, useMemo, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';
import type { CategoryStat, DailyDataPoint } from '../../utils/statsUtils';
import type { Dimension } from './DailyTrendCard';

const DIMENSION_LABELS: Record<Dimension, string> = {
  expense: '支出',
  income: '收入',
  balance: '结余',
};

const TAB_ACTIVE_COLORS: Record<Dimension, string> = {
  expense: colors.coral,
  income: colors.sage,
  balance: colors.honey,
};

interface CategoryRankCardProps {
  readonly expenseByCategory: CategoryStat[];
  readonly incomeByCategory: CategoryStat[];
  readonly dailyData: DailyDataPoint[];
  readonly dimension: Dimension;
  readonly onDimensionChange: (d: Dimension) => void;
  readonly onCategoryPress?: (categoryId: string) => void;
}

const MAX_BAR_WIDTH = 120;

function formatAmount(n: number): string {
  if (n === 0) return '—';
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CategoryRankCard({
  expenseByCategory,
  incomeByCategory,
  dailyData,
  dimension,
  onDimensionChange,
  onCategoryPress,
}: CategoryRankCardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleTabPress = (d: Dimension) => {
    onDimensionChange(d);
    setExpanded(false);
  };

  // ── 分类排行视图所需数据 ──
  const data = dimension === 'expense' ? expenseByCategory : incomeByCategory;
  const maxAmt = data[0]?.amount ?? 1;
  const top = data[0];
  const visible = expanded ? data : data.slice(0, 3);

  const pieData = useMemo(
    () => data.map((c) => ({ value: c.percent, color: c.color })),
    [data],
  );

  const legendData = useMemo(
    () => data.filter((c) => c.percent > 0),
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

  // ── 结余每日报表所需数据 ──
  const totals = useMemo(() => {
    let expense = 0;
    let income = 0;
    for (const d of dailyData) {
      expense += d.expense;
      income += d.income;
    }
    return { expense, income, balance: income - expense };
  }, [dailyData]);

  const isBalance = dimension === 'balance';
  const title = isBalance ? '每日报表' : '分类排行榜';

  return (
    <Card radius="lg" shadow="md" padding={16}>
      {/* Header */}
      <View style={styles.header}>
        <AppText size="lg" weight="semibold" color={colors.text}>{title}</AppText>
        <View style={styles.tabs}>
          {(['expense', 'income', 'balance'] as const).map((d) => (
            <Pressable
              key={d}
              onPress={() => handleTabPress(d)}
              style={[styles.tab, dimension === d && { backgroundColor: TAB_ACTIVE_COLORS[d] }]}
            >
              <AppText size="sm" weight="semibold" color={dimension === d ? colors.white : colors.textLighter}>
                {DIMENSION_LABELS[d]}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {isBalance ? (
        /* ── 每日报表表格 ── */
        <View>
          {/* 表头 */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <AppText size="sm" weight="bold" color={colors.text} style={styles.colDate}>日期</AppText>
            <AppText size="sm" weight="bold" color={colors.text} style={styles.colAmount}>支出</AppText>
            <AppText size="sm" weight="bold" color={colors.text} style={styles.colAmount}>收入</AppText>
            <AppText size="sm" weight="bold" color={colors.text} style={styles.colAmount}>结余</AppText>
          </View>

          {/* 数据行 */}
          {dailyData.map((d) => {
            const bal = d.income - d.expense;
            return (
              <View key={d.date} style={[styles.tableRow, styles.tableDataRow]}>
                <AppText size="sm" color={colors.text} style={styles.colDate}>
                  {d.date.slice(5)}
                </AppText>
                <AppText size="sm" color={d.expense > 0 ? colors.coral : colors.textLighter} style={styles.colAmount}>
                  {formatAmount(d.expense)}
                </AppText>
                <AppText size="sm" color={d.income > 0 ? colors.sage : colors.textLighter} style={styles.colAmount}>
                  {formatAmount(d.income)}
                </AppText>
                <AppText size="sm" color={bal < 0 ? colors.coral : bal > 0 ? colors.sage : colors.textLighter} style={styles.colAmount}>
                  {formatAmount(bal)}
                </AppText>
              </View>
            );
          })}

          {/* 合计行 */}
          <View style={[styles.tableRow, styles.tableTotalRow]}>
            <AppText size="sm" weight="bold" color={colors.text} style={styles.colDate}>合计</AppText>
            <AppText size="sm" weight="bold" color={colors.coral} style={styles.colAmount}>
              {formatAmount(totals.expense)}
            </AppText>
            <AppText size="sm" weight="bold" color={colors.sage} style={styles.colAmount}>
              {formatAmount(totals.income)}
            </AppText>
            <AppText
              size="sm"
              weight="bold"
              color={totals.balance < 0 ? colors.coral : totals.balance > 0 ? colors.sage : colors.text}
              style={styles.colAmount}
            >
              {formatAmount(totals.balance)}
            </AppText>
          </View>
        </View>
      ) : (
        /* ── 分类排行原有视图 ── */
        <>
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
          {legendData.length > 0 && (
            <View style={styles.legend}>
              {Array.from({ length: Math.ceil(legendData.length / 5) }, (_, row) =>
                legendData.slice(row * 5, row * 5 + 5)
              ).map((rowItems, row) => (
                <View key={`legend-row-${row}`} style={styles.legendRow}>
                  {rowItems.map((item) => (
                    <View key={`legend-${item.name}-${dimension}`} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <AppText size="xs" color={colors.textLight}>
                        {item.name} {item.percent}%
                      </AppText>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* Rank list */}
          <View style={styles.list}>
            {visible.map((item, index) => (
              <Pressable
                key={`${item.name}-${dimension}`}
                style={styles.rankRow}
                onPress={() => item.categoryId && onCategoryPress?.(item.categoryId)}
              >
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
                  color={dimension === 'expense' ? colors.coral : colors.sage}
                >
                  {dimension === 'expense' ? '-' : '+'}¥{item.amount.toLocaleString('zh-CN', {
                    maximumFractionDigits: 0,
                  })}
                </AppText>
              </Pressable>
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
        </>
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
    gap: 4,
  },
  tab: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  // ── 表格样式 ──
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tableHeader: {
    borderBottomWidth: 1.5,
    borderBottomColor: colors.honey,
  },
  tableDataRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.creamDark,
  },
  tableTotalRow: {
    borderTopWidth: 1.5,
    borderTopColor: colors.honey,
    marginTop: -StyleSheet.hairlineWidth,
  },
  colDate: {
    width: 60,
    textAlign: 'center',
  },
  colAmount: {
    flex: 1,
    textAlign: 'center',
  },
  // ── 分类排行样式 ──
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
    gap: 6,
    marginBottom: 16,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
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

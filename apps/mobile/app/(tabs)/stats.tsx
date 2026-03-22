import { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useLocalTransactions } from '../../hooks/useLocalTransactions';
import { useLocalCategories } from '../../hooks/useLocalCategories';
import { PeriodTabs } from '../../components/stats/PeriodTabs';
import { MonthSelector } from '../../components/stats/MonthSelector';
import { BarChartCard } from '../../components/stats/BarChartCard';
import { DonutChartCard } from '../../components/stats/DonutChartCard';
import { TrendInsightRow } from '../../components/stats/TrendInsightRow';
import { Card } from '../../components/ui/Card';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../constants/theme';
import type { Transaction, Category } from '@coco/shared';

type Period = 'week' | 'month' | 'year';

function formatMonthLabel(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function filterByPeriodAndMonth(
  transactions: readonly Transaction[],
  period: Period,
  currentDate: Date,
): Transaction[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  return transactions.filter((tx) => {
    const d = new Date(tx.occurred_at);
    if (period === 'month') {
      return d.getFullYear() === year && d.getMonth() === month;
    }
    if (period === 'year') {
      return d.getFullYear() === year;
    }
    // week: last 7 days from the reference date
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(currentDate);
    endOfWeek.setHours(23, 59, 59, 999);
    return d >= startOfWeek && d <= endOfWeek;
  });
}

const CATEGORY_COLORS = [
  colors.coral,
  colors.sage,
  colors.honey,
  colors.lavender,
  colors.coralLight,
  colors.sageLight,
];

const WEEKLY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const AI_INSIGHTS = [
  { emoji: '🍜', title: '餐饮支出偏高', desc: '本月餐饮占总支出 42%，高于上月', badge: { text: '↑ 12%', direction: 'up' as const } },
  { emoji: '🚌', title: '交通花费稳定', desc: '交通支出与上月基本持平', badge: { text: '↓ 3%', direction: 'down' as const } },
  { emoji: '💡', title: '建议设置餐饮预算', desc: '合理规划有助于减少月末超支' },
];

export default function StatsScreen() {
  const [period, setPeriod] = useState<Period>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: txData } = useLocalTransactions();
  const { data: categories = [] } = useLocalCategories();

  const allTransactions: readonly Transaction[] = txData?.data ?? [];

  const categoryMap = useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach((c) => { map[c.id] = c; });
    return map;
  }, [categories]);

  const filtered = useMemo(
    () => filterByPeriodAndMonth(allTransactions, period, currentDate),
    [allTransactions, period, currentDate],
  );

  const totalExpense = useMemo(
    () => filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    [filtered],
  );
  const totalIncome = useMemo(
    () => filtered.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
    [filtered],
  );
  const balance = totalIncome - totalExpense;

  // Category breakdown for donut chart
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { emoji: string; name: string; amount: number }> = {};
    filtered
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const cat = categoryMap[t.category_id];
        const key = cat?.name ?? '其他';
        if (!map[key]) map[key] = { emoji: cat?.icon ?? '📦', name: key, amount: 0 };
        map[key].amount += Number(t.amount);
      });
    return map;
  }, [filtered, categoryMap]);

  const categoryData = useMemo(() => {
    const total = totalExpense || 1;
    return Object.entries(categoryBreakdown)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 5)
      .map(([, { emoji, name, amount }], index) => ({
        emoji,
        name,
        amount,
        percent: Math.round((amount / total) * 100),
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }));
  }, [categoryBreakdown, totalExpense]);

  // Weekly bar chart data (current week Mon-Sun)
  const weeklyData = useMemo(() => {
    return WEEKLY_LABELS.map((label, dayIndex) => {
      const targetDay = new Date(currentDate);
      const currentDayOfWeek = currentDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
      targetDay.setDate(currentDate.getDate() + mondayOffset + dayIndex);
      const datePrefix = targetDay.toISOString().slice(0, 10);

      const dayTxs = allTransactions.filter((t) => t.occurred_at.slice(0, 10) === datePrefix);
      const expense = dayTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      const income = dayTxs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      return { label, expense, income };
    });
  }, [allTransactions, currentDate]);

  function handlePrev() {
    const d = new Date(currentDate);
    if (period === 'month') d.setMonth(d.getMonth() - 1);
    else if (period === 'year') d.setFullYear(d.getFullYear() - 1);
    else d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  }

  function handleNext() {
    const d = new Date(currentDate);
    if (period === 'month') d.setMonth(d.getMonth() + 1);
    else if (period === 'year') d.setFullYear(d.getFullYear() + 1);
    else d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  }

  const monthLabel = formatMonthLabel(currentDate);
  const totalStr = `¥${totalExpense.toFixed(0)}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <AppText size="5xl" weight="bold" color={colors.text}>统计</AppText>
        <PeriodTabs active={period} onChange={setPeriod} />
      </View>

      {/* Month selector */}
      <MonthSelector label={monthLabel} onPrev={handlePrev} onNext={handleNext} />

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <Card radius="md" shadow="sm" padding={12} style={styles.summaryCard}>
          <AppText size="sm" color={colors.textLighter}>支出</AppText>
          <AppText size="2xl" weight="bold" color={colors.coral}>¥{totalExpense.toFixed(0)}</AppText>
        </Card>
        <Card radius="md" shadow="sm" padding={12} style={styles.summaryCard}>
          <AppText size="sm" color={colors.textLighter}>收入</AppText>
          <AppText size="2xl" weight="bold" color={colors.sage}>¥{totalIncome.toFixed(0)}</AppText>
        </Card>
        <Card radius="md" shadow="sm" padding={12} style={styles.summaryCard}>
          <AppText size="sm" color={colors.textLighter}>结余</AppText>
          <AppText size="2xl" weight="bold" color={colors.text}>¥{balance.toFixed(0)}</AppText>
        </Card>
      </View>

      {/* Bar chart */}
      <BarChartCard data={weeklyData} />

      {/* Donut chart */}
      {categoryData.length > 0 ? (
        <DonutChartCard data={categoryData} total={totalStr} />
      ) : (
        <Card radius="lg" shadow="md" padding={16}>
          <AppText size="lg" weight="semibold" color={colors.text} style={styles.mb8}>支出分类</AppText>
          <AppText size="xl" color={colors.textLighter} style={styles.center}>暂无支出数据</AppText>
        </Card>
      )}

      {/* AI insights */}
      <TrendInsightRow items={AI_INSIGHTS} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
  },
  mb8: {
    marginBottom: 8,
  },
  center: {
    textAlign: 'center',
  },
});

import { useState, useMemo, useCallback } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalTransactions } from '../../hooks/useLocalTransactions';
import { useLocalCategories } from '../../hooks/useLocalCategories';
import { AccountSelectorBar } from '../../components/stats/AccountSelectorBar';
import { SummaryOverviewCard } from '../../components/stats/SummaryOverviewCard';
import { DailyTrendCard } from '../../components/stats/DailyTrendCard';
import { CategoryRankCard } from '../../components/stats/CategoryRankCard';
import { TransactionRankCard } from '../../components/stats/TransactionRankCard';
import { TrendInsightRow } from '../../components/stats/TrendInsightRow';
import { colors } from '../../constants/theme';
import {
  buildDailyData,
  buildCategoryStats,
  buildTransactionRank,
  computeDaysElapsed,
  buildDateRangeLabel,
  formatMonthLabelPadded,
} from '../../utils/statsUtils';
import type { Transaction, Category } from '@coco/shared';

function filterByMonth(
  transactions: readonly Transaction[],
  currentDate: Date,
): Transaction[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  return transactions.filter((tx) => {
    const d = new Date(tx.occurred_at);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

const CATEGORY_COLORS = [
  colors.coral,
  colors.sage,
  colors.honey,
  colors.lavender,
  colors.coralLight,
  colors.sageLight,
] as const;

const AI_INSIGHTS = [
  { emoji: '🍜', title: '餐饮支出偏高', desc: '较上月增长 18%，建议控制外卖频次', badge: { text: '↑ 18%', direction: 'up' as const } },
  { emoji: '🚌', title: '交通支出正常', desc: '较上月减少 5%，保持得不错', badge: { text: '↓ 5%', direction: 'down' as const } },
  { emoji: '💡', title: '节省建议', desc: '本月如减少 3 次外卖，可省约 ¥120' },
];

export default function StatsScreen() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: txData } = useLocalTransactions();
  const { data: categories = [] } = useLocalCategories();

  const allTransactions: readonly Transaction[] = txData?.data ?? [];

  const categoryMap = useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [categories]);

  // 月份过滤（固定月视图）
  const filtered = useMemo(
    () => filterByMonth(allTransactions, currentDate),
    [allTransactions, currentDate],
  );

  // 收支总计
  const totalExpense = useMemo(
    () => filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    [filtered],
  );
  const totalIncome = useMemo(
    () => filtered.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
    [filtered],
  );
  const balance = totalIncome - totalExpense;

  // 日均
  const daysElapsed = useMemo(() => computeDaysElapsed(currentDate), [currentDate]);
  const avgExpense = totalExpense / daysElapsed;
  const avgIncome = totalIncome / daysElapsed;
  const avgBalance = balance / daysElapsed;

  // 日维度数据
  const dailyData = useMemo(
    () => buildDailyData(filtered, currentDate),
    [filtered, currentDate],
  );

  // 分类统计
  const expenseByCat = useMemo(
    () => buildCategoryStats(filtered, 'expense', categoryMap, CATEGORY_COLORS),
    [filtered, categoryMap],
  );
  const incomeByCat = useMemo(
    () => buildCategoryStats(filtered, 'income', categoryMap, CATEGORY_COLORS),
    [filtered, categoryMap],
  );

  // 明细排行
  const expenseRank = useMemo(
    () => buildTransactionRank(filtered, 'expense', categoryMap),
    [filtered, categoryMap],
  );
  const incomeRank = useMemo(
    () => buildTransactionRank(filtered, 'income', categoryMap),
    [filtered, categoryMap],
  );

  // 月份导航
  const handlePrev = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  }, []);

  const handleNext = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  }, []);

  const monthLabel = formatMonthLabelPadded(currentDate);
  const dateRangeLabel = buildDateRangeLabel(currentDate);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AccountSelectorBar
        monthLabel={monthLabel}
        onPrev={handlePrev}
        onNext={handleNext}
      />
      <SummaryOverviewCard
        totalExpense={totalExpense}
        totalIncome={totalIncome}
        balance={balance}
        avgExpense={avgExpense}
        avgIncome={avgIncome}
        avgBalance={avgBalance}
        dateRangeLabel={dateRangeLabel}
      />
      <DailyTrendCard dailyData={dailyData} />
      <CategoryRankCard
        expenseByCategory={expenseByCat}
        incomeByCategory={incomeByCat}
      />
      <TransactionRankCard
        expenseTransactions={expenseRank}
        incomeTransactions={incomeRank}
      />
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
});

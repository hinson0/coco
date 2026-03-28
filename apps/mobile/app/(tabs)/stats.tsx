import { useState, useMemo, useCallback } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { useMonthlyTransactions } from '../../hooks/useLocalTransactions';
import { useLocalCategories } from '../../hooks/useLocalCategories';
import { useAccounts } from '../../hooks/useLocalAccounts';
import { AccountSelectorBar } from '../../components/stats/AccountSelectorBar';
import { SummaryOverviewCard } from '../../components/stats/SummaryOverviewCard';
import { DailyTrendCard, type Dimension } from '../../components/stats/DailyTrendCard';
import { CategoryRankCard } from '../../components/stats/CategoryRankCard';
import { TransactionRankCard } from '../../components/stats/TransactionRankCard';
import { TrendInsightRow } from '../../components/stats/TrendInsightRow';
import { runInsightRules } from '../../utils/insights/runInsightRules';
import type { InsightContext } from '../../utils/insights/types';
import { colors } from '../../constants/theme';
import {
  buildDailyData,
  buildCategoryStats,
  buildTransactionRank,
  computeDaysElapsed,
  buildDateRangeLabel,
} from '../../utils/statsUtils';
import type { Category } from '@coco/shared';

const CATEGORY_COLORS = [
  colors.coral,
  colors.sage,
  colors.honey,
  colors.lavender,
  colors.coralLight,
  colors.sageLight,
] as const;

export default function StatsScreen() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dimension, setDimension] = useState<Dimension>('expense');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const { data: filtered = [] } = useMonthlyTransactions(year, month, selectedAccountId);
  const { data: categories = [] } = useLocalCategories();
  const { data: accounts = [] } = useAccounts();

  // 上月交易（用于环比对比）
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const { data: prevFiltered = [] } = useMonthlyTransactions(prevYear, prevMonth, selectedAccountId);

  const categoryMap = useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [categories]);

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

  // AI 洞察
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const insights = useMemo(() => {
    const ctx: InsightContext = {
      currentMonth: filtered,
      previousMonth: prevFiltered,
      categories,
      year,
      month,
      daysInMonth,
      daysElapsed,
    };
    return runInsightRules(ctx);
  }, [filtered, prevFiltered, categories, year, month, daysInMonth, daysElapsed]);

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

  // 月份选择
  const handleDateChange = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  const handleCategoryPress = useCallback((categoryId: string) => {
    router.push({ pathname: '/category-detail', params: { categoryId } });
  }, []);

  const dateRangeLabel = buildDateRangeLabel(currentDate);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AccountSelectorBar
        currentDate={currentDate}
        onDateChange={handleDateChange}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onAccountChange={setSelectedAccountId}
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
      <DailyTrendCard dailyData={dailyData} dimension={dimension} onDimensionChange={setDimension} />
      <CategoryRankCard
        expenseByCategory={expenseByCat}
        incomeByCategory={incomeByCat}
        dailyData={dailyData}
        dimension={dimension}
        onDimensionChange={setDimension}
        onCategoryPress={handleCategoryPress}
      />
      <TransactionRankCard
        expenseTransactions={expenseRank}
        incomeTransactions={incomeRank}
        dimension={dimension}
      />
      <TrendInsightRow items={insights} />
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

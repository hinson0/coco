import { useState, useMemo } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import type { Transaction, Category } from '@coco/shared';
import { useMonthlyTransactions } from '../hooks/useLocalTransactions';
import { useLocalCategories } from '../hooks/useLocalCategories';
import { FilterBar, ALL_EXPENSE, ALL_INCOME } from '../components/bills/FilterBar';
import { MonthStrip } from '../components/bills/MonthStrip';
import { DayGroup } from '../components/shared/DayGroup';
import { TransactionItem } from '../components/shared/TransactionItem';
import { AppText } from '../components/ui/AppText';
import { colors, radii, shadows, getCategoryColor } from '../constants/theme';

// ─── Helper: date label ──────────────────────────────────────────────────────

function formatDayLabel(dateStr: string): { label: string; date: string } {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  let label: string;
  if (isSameDay(d, today)) {
    label = '今天';
  } else if (isSameDay(d, yesterday)) {
    label = '昨天';
  } else {
    label = `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return { label, date: weekdays[d.getDay()] };
}

// ─── Helper: group transactions by date ─────────────────────────────────────

interface DayData {
  readonly key: string;
  readonly label: string;
  readonly date: string;
  readonly transactions: Transaction[];
  readonly dayExpense: number;
  readonly dayIncome: number;
}

function groupByDay(transactions: readonly Transaction[]): DayData[] {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = t.occurred_at.slice(0, 10);
    const existing = map.get(key);
    if (existing) existing.push(t);
    else map.set(key, [t]);
  }

  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, txns]) => {
      const { label, date } = formatDayLabel(key);
      const dayExpense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const dayIncome = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      return { key, label, date, transactions: txns, dayExpense, dayIncome };
    });
}

// ─── Helper: format money ─────────────────────────────────────────────────────

function fmt(amount: number): string {
  return `¥${Math.abs(amount).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

// ─── Helper: compute stats for filtered transactions ─────────────────────────

function computeStats(transactions: readonly Transaction[]): { count: number; total: string } {
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  return { count: transactions.length, total: fmt(totalExpense) };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CategoryDetailScreen() {
  const { categoryId, year, month } = useLocalSearchParams<{ categoryId: string; year: string; month: string }>();
  const [activeFilter, setActiveFilter] = useState(categoryId ?? ALL_EXPENSE);

  const now = new Date();
  const displayYear = year ? Number(year) : now.getFullYear();
  const displayMonth = month ? Number(month) : now.getMonth();
  const { data: allTransactions = [], isLoading: txLoading } = useMonthlyTransactions(
    displayYear,
    displayMonth,
  );
  const { data: categories = [] } = useLocalCategories();

  const catMap = new Map<string, Category>(categories.map(c => [c.id, c]));

  const EXPENSE_ORDER: Record<string, number> = {
    '购物': 0, '餐饮': 1, '娱乐': 2, '交通': 3,
    '其他支出': 4, '教育': 5, '居住': 6, '医疗': 7, '通讯': 8,
  };
  const INCOME_ORDER: Record<string, number> = { '工资': 0, '理财': 1, '其他收入': 2 };
  const sortedCategories = useMemo(() => {
    const mapped = categories.map(c => ({ id: c.id, name: c.name, type: c.type }));
    const expenses = mapped
      .filter(c => c.type === 'expense')
      .sort((a, b) => (EXPENSE_ORDER[a.name] ?? 99) - (EXPENSE_ORDER[b.name] ?? 99));
    const incomes = mapped
      .filter(c => c.type === 'income')
      .sort((a, b) => (INCOME_ORDER[a.name] ?? 99) - (INCOME_ORDER[b.name] ?? 99));
    return [...expenses, ...incomes];
  }, [categories]);

  const filteredTransactions = activeFilter === ALL_EXPENSE
    ? allTransactions.filter(t => t.type === 'expense')
    : activeFilter === ALL_INCOME
    ? allTransactions.filter(t => t.type === 'income')
    : allTransactions.filter(t => t.category_id === activeFilter);

  const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`;
  const monthStats = computeStats(filteredTransactions);
  const days = groupByDay(filteredTransactions);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" backgroundColor={colors.cream} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.push('/(tabs)/diary')}
          style={[styles.iconBtn, styles.headerBack]}
          activeOpacity={0.75}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <AppText size="5xl" weight="bold" color={colors.text}>分类账单</AppText>
        {/* 右侧占位，保持标题居中 */}
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Category filter chips */}
        <FilterBar
          categories={sortedCategories}
          activeId={activeFilter}
          onSelect={setActiveFilter}
          wrap
        />

        {/* Month summary strip */}
        <MonthStrip
          month={monthLabel}
          count={monthStats.count}
          total={monthStats.total}
        />

        {/* Transaction list */}
        <View style={styles.txSection}>
          {txLoading ? (
            <ActivityIndicator color={colors.sage} style={styles.loader} />
          ) : days.length === 0 ? (
            <View style={styles.empty}>
              <AppText color={colors.textLighter} size="lg">
                {activeFilter ? '该分类暂无记录 🌿' : '还没有记录，快去记一笔吧 🌿'}
              </AppText>
            </View>
          ) : (
            days.map(day => {
              const totalColor = day.dayExpense > 0 ? colors.coral : colors.sage;
              const totalStr =
                day.dayExpense > 0 && day.dayIncome > 0
                  ? `-¥${day.dayExpense.toLocaleString()} / +¥${day.dayIncome.toLocaleString()}`
                  : day.dayExpense > 0
                  ? `-¥${day.dayExpense.toLocaleString()}`
                  : `+¥${day.dayIncome.toLocaleString()}`;

              return (
                <DayGroup
                  key={day.key}
                  label={day.label}
                  date={day.date}
                  total={totalStr}
                  totalColor={totalColor}
                >
                  {day.transactions.map(txn => {
                    const cat = catMap.get(txn.category_id);
                    const catName = cat?.name ?? '其他';
                    const catIcon = cat?.icon ?? '📦';
                    const catColor = getCategoryColor(catName);

                    return (
                      <TransactionItem
                        key={txn.id}
                        transaction={txn}
                        categoryIcon={catIcon}
                        categoryName={catName}
                        categoryColor={catColor}
                      />
                    );
                  })}
                </DayGroup>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: colors.cream,
  },
  headerBack: {
    position: 'relative',
  },
  headerPlaceholder: {
    width: 36,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  backArrow: {
    fontSize: 18,
    color: colors.text,
    lineHeight: 22,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  txSection: {
    paddingHorizontal: 20,
  },
  loader: {
    marginTop: 40,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
  },
});

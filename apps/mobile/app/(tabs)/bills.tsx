import { useState } from 'react';
import { ScrollView, View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import type { Transaction, Category } from '@coco/shared';
import { useLocalTransactions } from '../../hooks/useLocalTransactions';
import { useLocalCategories } from '../../hooks/useLocalCategories';
import { useOfflineContext } from '../../lib/offline-context';
import { FilterBar, ALL_EXPENSE } from '../../components/bills/FilterBar';
import { MonthStrip } from '../../components/bills/MonthStrip';
import { DayGroup } from '../../components/shared/DayGroup';
import { TransactionItem } from '../../components/shared/TransactionItem';
import { AppText } from '../../components/ui/AppText';
import { colors, radii, shadows, getCategoryColor } from '../../constants/theme';

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
    const month = d.getMonth() + 1;
    const day = d.getDate();
    label = `${month}月${day}日`;
  }

  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const date = weekdays[d.getDay()];

  return { label, date };
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
    if (existing) {
      existing.push(t);
    } else {
      map.set(key, [t]);
    }
  }

  const sorted = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return sorted.map(([key, txns]) => {
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

// ─── Helper: current month label ─────────────────────────────────────────────

function currentMonthLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}年${now.getMonth() + 1}月`;
}

// ─── Hook: current month stats from DB ───────────────────────────────────────

function useCurrentMonthStats(categoryId?: string) {
  const { db, userId } = useOfflineContext();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  return useQuery({
    queryKey: ['transactions', 'month-stats', categoryId ?? 'all', userId],
    queryFn: async () => {
      if (!db || !userId) return { count: 0, expense: 0 };
      const catFilter = categoryId ? ' AND category_id = ?' : '';
      const params: (string | number)[] = [userId, monthStart, monthEnd];
      if (categoryId) params.push(categoryId);
      const row = await db.getFirstAsync<{ count: number; expense: number }>(
        `SELECT COUNT(*) as count, COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense FROM transactions WHERE user_id = ? AND deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ?${catFilter}`,
        ...params
      );
      return { count: row?.count ?? 0, expense: row?.expense ?? 0 };
    },
    enabled: !!db && !!userId,
  });
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BillsScreen() {
  const [activeFilter, setActiveFilter] = useState(ALL_EXPENSE);

  const { data: txData, isLoading: txLoading } = useLocalTransactions();
  const { data: categories = [] } = useLocalCategories();

  const allTransactions: readonly Transaction[] = txData?.data ?? [];

  const catMap = new Map<string, Category>(categories.map(c => [c.id, c]));

  // Filter transactions by active category
  const filteredTransactions = activeFilter === ALL_EXPENSE
    ? allTransactions
    : allTransactions.filter(t => t.category_id === activeFilter);

  const categoryId = activeFilter === ALL_EXPENSE ? undefined : activeFilter;
  const { data: monthStats } = useCurrentMonthStats(categoryId);
  const days = groupByDay(filteredTransactions);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" backgroundColor={colors.cream} />

      {/* Fixed header */}
      <View style={styles.header}>
        <AppText size="5xl" weight="bold" color={colors.text}>账单</AppText>
        <TouchableOpacity style={styles.searchBtn} activeOpacity={0.7}>
          <AppText size="xl">🔍</AppText>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Category filter chips */}
        <FilterBar
          categories={categories.map(c => ({ id: c.id, name: c.name }))}
          activeId={activeFilter}
          onSelect={setActiveFilter}
        />

        {/* Month summary strip */}
        <MonthStrip
          month={currentMonthLabel()}
          count={monthStats?.count ?? 0}
          total={fmt(monthStats?.expense ?? 0)}
        />

        {/* Transaction list */}
        <View style={styles.txSection}>
          {txLoading ? (
            <ActivityIndicator color={colors.sage} style={styles.loader} />
          ) : days.length === 0 ? (
            <View style={styles.empty}>
              <AppText color={colors.textLighter} size="lg">
                {activeFilter !== ALL_EXPENSE ? '该分类暂无记录 🌿' : '还没有记录，快去记一笔吧 🌿'}
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
  searchBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
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

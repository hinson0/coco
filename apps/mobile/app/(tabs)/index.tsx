import { useEffect, useRef } from 'react';
import { ScrollView, View, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import type { Transaction, Category, Budget } from '@coco/shared';
import { useTransactions } from '../../hooks/useTransactions';
import { useBudgets } from '../../hooks/useBudgets';
import { useCategories } from '../../hooks/useCategories';
import { HeaderGreeting } from '../../components/home/HeaderGreeting';
import { OverviewCard } from '../../components/shared/OverviewCard';
import { DayGroup } from '../../components/shared/DayGroup';
import { TransactionItem } from '../../components/shared/TransactionItem';
import { AppText } from '../../components/ui/AppText';
import { colors, getCategoryColor } from '../../constants/theme';

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
  readonly key: string; // YYYY-MM-DD
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

// ─── Helper: compute stats ───────────────────────────────────────────────────

interface Stats {
  expense: string;
  income: string;
  balance: string;
  budget: string;
  remaining: string;
  dailyAvg: string;
  budgetPercent: number;
  daysLeft: number;
}

function computeStats(transactions: readonly Transaction[], budgets: readonly Budget[]): Stats {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const monthTxns = transactions.filter(t => {
    const d = new Date(t.occurred_at);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const totalExpense = monthTxns
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const totalIncome = monthTxns
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  // Use monthly overall budget (null category_id = overall)
  const monthlyBudget =
    budgets.find(b => b.period === 'monthly' && b.category_id === null) ??
    budgets.find(b => b.period === 'monthly');

  const budgetAmount = monthlyBudget?.amount ?? 0;
  const remaining = Math.max(0, budgetAmount - totalExpense);

  // Days left in month
  const totalDays = new Date(year, month + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysLeft = Math.max(1, totalDays - currentDay);

  const dailyAvg = daysLeft > 0 ? remaining / daysLeft : 0;
  const budgetPercent =
    budgetAmount > 0 ? Math.min(100, Math.round((totalExpense / budgetAmount) * 100)) : 0;

  return {
    expense: fmt(totalExpense),
    income: fmt(totalIncome),
    balance: fmt(balance),
    budget: fmt(budgetAmount),
    remaining: fmt(remaining),
    dailyAvg: fmt(dailyAvg),
    budgetPercent,
    daysLeft,
  };
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  // Auto-navigate to AI chat on first mount only
  const hasAutoNavigated = useRef(false);
  useEffect(() => {
    if (!hasAutoNavigated.current) {
      hasAutoNavigated.current = true;
      router.push('/chat');
    }
  }, []);

  const { data: txData, isLoading: txLoading } = useTransactions();
  const { data: budgetData } = useBudgets();
  const { data: catData } = useCategories();

  const transactions: readonly Transaction[] = txData?.data ?? [];
  const budgets: readonly Budget[] = budgetData?.data ?? [];
  const categories: readonly Category[] = catData?.data ?? [];

  const catMap = new Map<string, Category>(categories.map(c => [c.id, c]));

  const stats = computeStats(transactions, budgets);
  const days = groupByDay(transactions);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" backgroundColor={colors.cream} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <HeaderGreeting />

        {/* Overview stats card */}
        <View style={styles.cardWrapper}>
          <OverviewCard
            expense={stats.expense}
            income={stats.income}
            balance={stats.balance}
            budget={stats.budget}
            remaining={stats.remaining}
            dailyAvg={stats.dailyAvg}
            budgetPercent={stats.budgetPercent}
            daysLeft={stats.daysLeft}
          />
        </View>

        {/* Transaction list */}
        <View style={styles.txSection}>
          {txLoading ? (
            <ActivityIndicator color={colors.sage} style={styles.loader} />
          ) : days.length === 0 ? (
            <View style={styles.empty}>
              <AppText color={colors.textLighter} size="lg">还没有记录，快去记一笔吧 🌿</AppText>
            </View>
          ) : (
            days.map(day => {
              const totalColor =
                day.dayExpense > 0 ? colors.coral : colors.sage;
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 54,
    paddingBottom: 100,
  },
  cardWrapper: {
    marginHorizontal: 20,
    marginBottom: 20,
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

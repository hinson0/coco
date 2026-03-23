import { useCallback } from 'react';
import { FlatList, View, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import type { Transaction, Category, Budget } from '@coco/shared';
import { useMonthlyTransactions } from '../../hooks/useLocalTransactions';
import { useLocalBudgets } from '../../hooks/useLocalBudgets';
import { useLocalCategories } from '../../hooks/useLocalCategories';
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
  const abs = Math.abs(amount).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  return amount < 0 ? `-¥${abs}` : `¥${abs}`;
}

// ─── Helper: compute stats ───────────────────────────────────────────────────

interface Stats {
  expense: string;
  income: string;
  balance: string;
  balanceRaw: number;
  budget: string;
  remaining: string;
  dailyAvg: string;
  budgetPercent: number;
  daysLeft: number;
  hasBudget: boolean;
}

function computeStats(transactions: readonly Transaction[], budgets: readonly Budget[]): Stats {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // With useMonthlyTransactions, all transactions are already this month
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  // Use monthly overall budget (null category_id = overall)
  const monthlyBudget =
    budgets.find(b => b.period === 'monthly' && b.category_id === null) ??
    budgets.find(b => b.period === 'monthly');

  const hasBudget = monthlyBudget !== undefined;
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
    balanceRaw: balance,
    budget: hasBudget ? fmt(budgetAmount) : '点击设置',
    remaining: hasBudget ? fmt(remaining) : '--',
    dailyAvg: hasBudget ? fmt(dailyAvg) : '--',
    budgetPercent,
    daysLeft,
    hasBudget,
  };
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const now = new Date();
  const { data: transactions = [], isLoading: txLoading, refetch } = useMonthlyTransactions(now.getFullYear(), now.getMonth());
  const { data: budgets = [], refetch: refetchBudgets } = useLocalBudgets();
  const { data: categories = [] } = useLocalCategories();

  // Refetch data when tab gains focus
  useFocusEffect(useCallback(() => { refetch(); refetchBudgets(); }, [refetch, refetchBudgets]));

  const catMap = new Map<string, Category>(categories.map(c => [c.id, c]));

  const stats = computeStats(transactions, budgets);
  const days = groupByDay(transactions);

  function handlePressBudget() {
    router.push('/budget-setting');
  }

  function renderDayGroup({ item: day }: { item: DayData }) {
    const totalColor = day.dayExpense > 0 ? colors.coral : colors.sage;
    const totalStr =
      day.dayExpense > 0 && day.dayIncome > 0
        ? `-¥${day.dayExpense.toLocaleString()} / +¥${day.dayIncome.toLocaleString()}`
        : day.dayExpense > 0
        ? `-¥${day.dayExpense.toLocaleString()}`
        : `+¥${day.dayIncome.toLocaleString()}`;

    return (
      <DayGroup
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
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" backgroundColor={colors.cream} />

      {/* Fixed header */}
      <View style={styles.fixedHeader}>
        <HeaderGreeting />
        <View style={styles.cardWrapper}>
          <OverviewCard
            expense={stats.expense}
            income={stats.income}
            balance={stats.balance}
            balanceRaw={stats.balanceRaw}
            budget={stats.budget}
            remaining={stats.remaining}
            dailyAvg={stats.dailyAvg}
            budgetPercent={stats.budgetPercent}
            daysLeft={stats.daysLeft}
            hasBudget={stats.hasBudget}
            onPressBudget={handlePressBudget}
          />
        </View>
      </View>

      {/* Scrollable transaction list */}
      {txLoading ? (
        <ActivityIndicator color={colors.sage} style={styles.loader} />
      ) : days.length === 0 ? (
        <View style={styles.empty}>
          <AppText color={colors.textLighter} size="lg">还没有记录，快去记一笔吧 🌿</AppText>
        </View>
      ) : (
        <FlatList
          data={days}
          keyExtractor={day => day.key}
          renderItem={renderDayGroup}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  fixedHeader: {
    paddingTop: 54,
  },
  cardWrapper: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  loader: {
    marginTop: 40,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
  },
});

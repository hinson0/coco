import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Transaction } from "@coco/shared";

interface TransactionWithCategory extends Transaction {
  readonly categories?: { readonly name: string; readonly icon: string } | null;
}

interface Props {
  readonly transactions: readonly TransactionWithCategory[];
}

export function DailySummary({ transactions }: Props) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);

  const monthTxs = transactions.filter((t) => t.occurred_at.slice(0, 7) === month);
  const monthIncome = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = monthIncome - monthExpense;

  const todayExpense = transactions
    .filter((t) => t.occurred_at.slice(0, 10) === today && t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  // Top spending category this month
  const categoryMap = new Map<string, number>();
  for (const t of monthTxs.filter((t) => t.type === "expense")) {
    const name = t.categories?.name ?? "未分类";
    categoryMap.set(name, (categoryMap.get(name) ?? 0) + t.amount);
  }
  let topCategory = "暂无";
  let topAmount = 0;
  for (const [name, amount] of categoryMap) {
    if (amount > topAmount) {
      topCategory = name;
      topAmount = amount;
    }
  }

  // Days with records this month
  const recordDays = new Set(monthTxs.map((t) => t.occurred_at.slice(0, 10))).size;

  const hour = now.getHours();
  const greeting = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";

  return (
    <View>
      <LinearGradient colors={["#2D9B83", "#3DAE94"]} style={styles.header}>
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingText}>{greeting} 👋</Text>
            <Text style={styles.userName}>我的账本</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>😊</Text>
          </View>
        </View>

        <Text style={styles.balanceLabel}>本月净结余</Text>
        <Text style={styles.balanceAmount}>
          ¥ {formatAmount(balance)}
        </Text>

        <View style={styles.incomeExpenseRow}>
          <View style={styles.incomeExpenseItem}>
            <Text style={styles.arrow}>↑ 收入</Text>
            <Text style={styles.subAmount}>¥ {formatInt(monthIncome)}</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.incomeExpenseItem}>
            <Text style={styles.arrow}>↓ 支出</Text>
            <Text style={styles.subAmount}>¥ {formatInt(monthExpense)}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>💰</Text>
          <Text style={styles.statLabel}>今日支出</Text>
          <Text style={styles.statValue}>¥ {formatInt(todayExpense)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🔥</Text>
          <Text style={styles.statLabel}>本月最多</Text>
          <Text style={styles.statValue}>{topCategory}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📊</Text>
          <Text style={styles.statLabel}>记账天数</Text>
          <Text style={styles.statValue}>{recordDays}天</Text>
        </View>
      </View>
    </View>
  );
}

function formatAmount(n: number): string {
  const abs = Math.abs(n);
  const intPart = Math.floor(abs).toLocaleString();
  const decPart = (abs % 1).toFixed(2).slice(1);
  return `${n < 0 ? "-" : ""}${intPart}${decPart}`;
}

function formatInt(n: number): string {
  return Math.floor(n).toLocaleString();
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greetingText: { color: "rgba(255,255,255,0.85)", fontSize: 14 },
  userName: { color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 2 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarEmoji: { fontSize: 22 },

  balanceLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13, textAlign: "center" },
  balanceAmount: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },

  incomeExpenseRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
  },
  incomeExpenseItem: { alignItems: "center" },
  arrow: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 2 },
  subAmount: { color: "#fff", fontSize: 16, fontWeight: "600" },
  rowDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.3)" },

  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: -28,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statIcon: { fontSize: 22, marginBottom: 6 },
  statLabel: { color: "#94a3b8", fontSize: 11, marginBottom: 4 },
  statValue: { color: "#2D9B83", fontSize: 16, fontWeight: "700" },
});

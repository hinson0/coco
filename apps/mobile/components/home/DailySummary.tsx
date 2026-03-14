import { View, Text, StyleSheet } from "react-native";
import type { Transaction } from "@coco/shared";

interface Props {
  readonly transactions: readonly Transaction[];
}

export function DailySummary({ transactions }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const todayTxs = transactions.filter((t) => t.occurred_at.slice(0, 10) === today);
  const income = todayTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = todayTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>今日收支</Text>
      <View style={styles.row}>
        <View style={styles.item}>
          <Text style={styles.label}>收入</Text>
          <Text style={[styles.amount, { color: "#22c55e" }]}>+¥{income.toFixed(2)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.item}>
          <Text style={styles.label}>支出</Text>
          <Text style={[styles.amount, { color: "#ef4444" }]}>-¥{expense.toFixed(2)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.item}>
          <Text style={styles.label}>结余</Text>
          <Text style={styles.amount}>¥{(income - expense).toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { margin: 16, marginTop: 0, backgroundColor: "#1e293b", borderRadius: 16, padding: 16 },
  title: { color: "#94a3b8", fontSize: 12, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-around" },
  item: { alignItems: "center" },
  label: { color: "#64748b", fontSize: 11, marginBottom: 4 },
  amount: { color: "#fff", fontSize: 18, fontWeight: "700" },
  divider: { width: 1, backgroundColor: "#334155" },
});

import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import type { Transaction } from "@coco/shared";
import { useDeleteTransaction } from "../../hooks/useTransactions";

interface Props {
  readonly transaction: Transaction;
  readonly onEdit?: (tx: Transaction) => void;
}

export function BillCard({ transaction: tx, onEdit }: Props) {
  const deleteMutation = useDeleteTransaction();
  const isExpense = tx.type === "expense";
  const lowConfidence = (tx.ai_confidence ?? 1) < 0.7;

  const handleDelete = () => {
    Alert.alert("删除记录", "确定要删除这条记录吗？", [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => deleteMutation.mutate(tx.id) },
    ]);
  };

  return (
    <View style={[styles.card, { borderLeftColor: isExpense ? "#ef4444" : "#22c55e" }]}>
      {lowConfidence && <Text style={styles.warning}>⚠️ 置信度较低，请确认</Text>}
      <View style={styles.main}>
        <View style={styles.left}>
          <Text style={styles.icon}>{tx.categories?.icon ?? "📦"}</Text>
          <View>
            <Text style={styles.category}>{tx.categories?.name ?? "未分类"}</Text>
            {tx.note ? <Text style={styles.note}>{tx.note}</Text> : null}
          </View>
        </View>
        <Text style={[styles.amount, { color: isExpense ? "#ef4444" : "#22c55e" }]}>
          {isExpense ? "-" : "+"}¥{tx.amount.toFixed(2)}
        </Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.date}>{tx.occurred_at.slice(0, 10)}</Text>
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity onPress={() => onEdit(tx)}>
              <Text style={styles.action}>✏️ 编辑</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleDelete}>
            <Text style={styles.action}>🗑️ 删除</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, borderLeftWidth: 3, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  warning: { color: "#d97706", fontSize: 10, marginBottom: 6, fontWeight: "600" },
  main: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  left: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { fontSize: 24 },
  category: { fontWeight: "600", fontSize: 14, color: "#0f172a" },
  note: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  amount: { fontWeight: "700", fontSize: 18 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  date: { color: "#94a3b8", fontSize: 10 },
  actions: { flexDirection: "row", gap: 12 },
  action: { color: "#94a3b8", fontSize: 10 },
});

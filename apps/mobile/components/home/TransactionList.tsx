import { FlatList, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import type { Transaction } from "@coco/shared";

// API 返回的 transaction 包含 join 后的 categories 字段
interface TransactionWithCategory extends Transaction {
  readonly categories?: { readonly name: string; readonly icon: string } | null;
}

interface Props {
  readonly transactions: readonly TransactionWithCategory[];
  readonly isLoading: boolean;
}

export function TransactionList({ transactions, isLoading }: Props) {
  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 40 }} color="#818cf8" />;
  }

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <View style={styles.left}>
            <Text style={styles.icon}>{item.categories?.icon ?? "📦"}</Text>
            <View>
              <Text style={styles.category}>{item.categories?.name ?? "未分类"}</Text>
              {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
            </View>
          </View>
          <Text style={[styles.amount, { color: item.type === "expense" ? "#ef4444" : "#22c55e" }]}>
            {item.type === "expense" ? "-" : "+"}¥{item.amount.toFixed(2)}
          </Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>暂无记录</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16 },
  item: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1e293b", borderRadius: 12, padding: 14, marginBottom: 8 },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { fontSize: 24 },
  category: { color: "#fff", fontSize: 14, fontWeight: "600" },
  note: { color: "#64748b", fontSize: 11, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: "700" },
  empty: { color: "#64748b", textAlign: "center", marginTop: 40 },
});

import { FlatList, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import type { Transaction } from "@coco/shared";

interface TransactionWithCategory extends Transaction {
  readonly categories?: { readonly name: string; readonly icon: string } | null;
}

interface Props {
  readonly transactions: readonly TransactionWithCategory[];
  readonly isLoading: boolean;
}

export function TransactionList({ transactions, isLoading }: Props) {
  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 40 }} color="#2D9B83" />;
  }

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <View style={styles.left}>
            <View style={[styles.iconWrap, { backgroundColor: item.type === "expense" ? "#FEF3C7" : "#D1FAE5" }]}>
              <Text style={styles.icon}>{item.categories?.icon ?? "📦"}</Text>
            </View>
            <View>
              <Text style={styles.category}>{item.categories?.name ?? "未分类"}</Text>
              {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
            </View>
          </View>
          <Text style={[styles.amount, { color: item.type === "expense" ? "#DC2626" : "#059669" }]}>
            {item.type === "expense" ? "-" : "+"}¥{item.amount.toFixed(2)}
          </Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>暂无记录</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 16 },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: { fontSize: 20 },
  category: { color: "#1e293b", fontSize: 14, fontWeight: "600" },
  note: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: "700" },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 40 },
});

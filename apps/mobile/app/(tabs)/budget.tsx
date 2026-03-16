import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useBudgets } from "../../hooks/useBudgets";

export default function BudgetScreen() {
  const { data, isLoading } = useBudgets();
  const budgets = data?.data ?? [];

  const totalBudget = budgets.reduce((s: number, b: any) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s: number, b: any) => s + (b.spent ?? 0), 0);
  const totalPercent = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>预算</Text>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2D9B83" />
      ) : (
        <>
          {/* Total budget overview */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>本月总预算</Text>
            <Text style={styles.totalAmount}>¥{totalSpent.toFixed(0)} / ¥{totalBudget.toFixed(0)}</Text>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${totalPercent}%`, backgroundColor: totalPercent > 90 ? "#DC2626" : "#2D9B83" }]} />
            </View>
            <Text style={styles.totalPercent}>{totalPercent.toFixed(0)}%</Text>
          </View>

          {/* Budget cards */}
          {budgets.map((budget: any) => {
            const spent = budget.spent ?? 0;
            const percent = budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0;
            const overBudget = spent > budget.amount;

            return (
              <View key={budget.id} style={styles.budgetCard}>
                <View style={styles.budgetHeader}>
                  <View style={styles.budgetLeft}>
                    <Text style={styles.budgetIcon}>{budget.categories?.icon ?? "📦"}</Text>
                    <Text style={styles.budgetName}>{budget.categories?.name ?? "未分类"}</Text>
                  </View>
                  <Text style={[styles.budgetAmount, overBudget && { color: "#DC2626" }]}>
                    ¥{spent.toFixed(0)} / ¥{budget.amount.toFixed(0)}
                  </Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: overBudget ? "#DC2626" : "#059669" }]} />
                </View>
              </View>
            );
          })}

          {/* Add budget button */}
          <TouchableOpacity style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ 添加预算</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5", paddingTop: 50 },
  pageTitle: { color: "#1e293b", fontSize: 24, fontWeight: "700", paddingHorizontal: 16, marginBottom: 16 },
  totalCard: {
    margin: 16, backgroundColor: "#fff", borderRadius: 16, padding: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  totalLabel: { color: "#94a3b8", fontSize: 12, marginBottom: 8 },
  totalAmount: { color: "#1e293b", fontSize: 22, fontWeight: "700", marginBottom: 12 },
  totalPercent: { color: "#94a3b8", fontSize: 12, textAlign: "right", marginTop: 4 },
  progressBg: { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  budgetCard: {
    marginHorizontal: 16, marginBottom: 10, backgroundColor: "#fff", borderRadius: 12, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  budgetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  budgetLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  budgetIcon: { fontSize: 20 },
  budgetName: { color: "#1e293b", fontSize: 14, fontWeight: "600" },
  budgetAmount: { color: "#64748b", fontSize: 13 },
  addBtn: {
    margin: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#D1D5DB",
    borderStyle: "dashed", alignItems: "center", backgroundColor: "#fff",
  },
  addBtnText: { color: "#2D9B83", fontSize: 14, fontWeight: "600" },
});

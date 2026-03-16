import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

type Period = "week" | "month" | "year";

function getDateRange(period: Period): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now);
  if (period === "week") start.setDate(now.getDate() - 7);
  else if (period === "month") start.setMonth(now.getMonth() - 1);
  else start.setFullYear(now.getFullYear() - 1);
  return { start: start.toISOString().slice(0, 10), end };
}

export default function StatsScreen() {
  const [period, setPeriod] = useState<Period>("month");
  const range = getDateRange(period);

  const { data, isLoading } = useQuery({
    queryKey: ["stats", period],
    queryFn: () => apiFetch<any>(`/api/stats?start_date=${range.start}&end_date=${range.end}`),
  });

  const stats = data?.data;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>统计</Text>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {(["week", "month", "year"] as const).map((p) => (
          <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodBtnActive]} onPress={() => setPeriod(p)}>
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {{ week: "周", month: "月", year: "年" }[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2D9B83" />
      ) : stats ? (
        <>
          {/* Summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>总收入</Text>
              <Text style={[styles.summaryAmount, { color: "#059669" }]}>+¥{(stats.totalIncome ?? 0).toFixed(2)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>总支出</Text>
              <Text style={[styles.summaryAmount, { color: "#DC2626" }]}>-¥{(stats.totalExpense ?? 0).toFixed(2)}</Text>
            </View>
          </View>

          {/* Category breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>分类支出排行</Text>
            {(stats.categoryBreakdown ?? []).map((cat: any, i: number) => (
              <View key={cat.name ?? i} style={styles.categoryRow}>
                <View style={styles.categoryLeft}>
                  <Text style={styles.categoryIcon}>{cat.icon ?? "📦"}</Text>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                </View>
                <View style={styles.categoryRight}>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${(cat.percentage ?? 0)}%` }]} />
                  </View>
                  <Text style={styles.categoryAmount}>¥{(cat.amount ?? 0).toFixed(0)}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.empty}>暂无数据</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5", paddingTop: 50 },
  pageTitle: { color: "#1e293b", fontSize: 24, fontWeight: "700", paddingHorizontal: 16, marginBottom: 16 },
  periodRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  periodBtn: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: "#fff", alignItems: "center" },
  periodBtnActive: { backgroundColor: "#2D9B83" },
  periodText: { color: "#64748b", fontSize: 14, fontWeight: "600" },
  periodTextActive: { color: "#fff" },
  summaryCard: {
    marginHorizontal: 16, backgroundColor: "#fff", borderRadius: 16, padding: 20,
    flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  summaryItem: { alignItems: "center" },
  summaryLabel: { color: "#94a3b8", fontSize: 12, marginBottom: 6 },
  summaryAmount: { fontSize: 20, fontWeight: "700" },
  summaryDivider: { width: 1, height: 36, backgroundColor: "#E5E7EB" },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { color: "#1e293b", fontSize: 16, fontWeight: "600", marginBottom: 12 },
  categoryRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 10, backgroundColor: "#fff", padding: 12, borderRadius: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  categoryLeft: { flexDirection: "row", alignItems: "center", gap: 8, width: 80 },
  categoryIcon: { fontSize: 18 },
  categoryName: { color: "#1e293b", fontSize: 13 },
  categoryRight: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 },
  barBg: { flex: 1, height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, backgroundColor: "#2D9B83", borderRadius: 4 },
  categoryAmount: { color: "#64748b", fontSize: 12, width: 60, textAlign: "right" },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 40 },
});

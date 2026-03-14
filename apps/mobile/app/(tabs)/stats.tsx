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
        <ActivityIndicator style={{ marginTop: 40 }} color="#818cf8" />
      ) : stats ? (
        <>
          {/* Summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>总收入</Text>
              <Text style={[styles.summaryAmount, { color: "#22c55e" }]}>+¥{(stats.totalIncome ?? 0).toFixed(2)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>总支出</Text>
              <Text style={[styles.summaryAmount, { color: "#ef4444" }]}>-¥{(stats.totalExpense ?? 0).toFixed(2)}</Text>
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
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 50 },
  pageTitle: { color: "#fff", fontSize: 24, fontWeight: "700", paddingHorizontal: 16, marginBottom: 16 },
  periodRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  periodBtn: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: "#1e293b", alignItems: "center" },
  periodBtnActive: { backgroundColor: "#6366f1" },
  periodText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  periodTextActive: { color: "#fff" },
  summaryCard: { marginHorizontal: 16, backgroundColor: "#1e293b", borderRadius: 16, padding: 20, flexDirection: "row", justifyContent: "space-around", marginBottom: 20 },
  summaryItem: { alignItems: "center" },
  summaryLabel: { color: "#64748b", fontSize: 12, marginBottom: 6 },
  summaryAmount: { fontSize: 20, fontWeight: "700" },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 12 },
  categoryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  categoryLeft: { flexDirection: "row", alignItems: "center", gap: 8, width: 80 },
  categoryIcon: { fontSize: 18 },
  categoryName: { color: "#cbd5e1", fontSize: 13 },
  categoryRight: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 },
  barBg: { flex: 1, height: 8, backgroundColor: "#334155", borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, backgroundColor: "#6366f1", borderRadius: 4 },
  categoryAmount: { color: "#94a3b8", fontSize: 12, width: 60, textAlign: "right" },
  empty: { color: "#64748b", textAlign: "center", marginTop: 40 },
});

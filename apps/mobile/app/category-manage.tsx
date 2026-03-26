// 分类列表管理页面 — 支出/收入 Tab 切换，预设保护，软删除
import { useState } from "react";
import { View, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalCategories, useDeleteCategory } from "../hooks/useLocalCategories";
import { AppText } from "../components/ui/AppText";
import { colors, radii, spacing, shadows } from "../constants/theme";
import type { TransactionType } from "@coco/shared";

export default function CategoryManageScreen() {
  const insets = useSafeAreaInsets();
  const { data: categories = [] } = useLocalCategories();
  const { mutateAsync: deleteCategory } = useDeleteCategory();
  const [activeTab, setActiveTab] = useState<TransactionType>("expense");

  const filtered = categories.filter((c) => c.type === activeTab);

  const handleDelete = (id: string, name: string) => {
    Alert.alert("删除分类", `确定要删除"${name}"吗？已有的交易记录不会受影响。`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => deleteCategory(id) },
    ]);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">分类管理</AppText>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "expense" && styles.tabActiveExpense]}
          onPress={() => setActiveTab("expense")}
          activeOpacity={0.7}
        >
          <AppText size="xl" weight="semibold" color={activeTab === "expense" ? colors.white : colors.textLight}>支出</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "income" && styles.tabActiveIncome]}
          onPress={() => setActiveTab("income")}
          activeOpacity={0.7}
        >
          <AppText size="xl" weight="semibold" color={activeTab === "income" ? colors.white : colors.textLight}>收入</AppText>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.is_default ? (
              <View style={styles.rowContent}>
                <View style={styles.iconBox}>
                  <AppText style={{ fontSize: 24 }}>{item.icon}</AppText>
                </View>
                <AppText size="xl" weight="medium" style={{ flex: 1 }}>{item.name}</AppText>
                <AppText size="sm" color={colors.textLighter}>预设</AppText>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.rowContent}
                  onPress={() => router.push({ pathname: "/category-edit", params: { id: item.id, name: item.name, icon: item.icon, type: item.type } })}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconBox}>
                    <AppText style={{ fontSize: 24 }}>{item.icon}</AppText>
                  </View>
                  <AppText size="xl" weight="medium" style={{ flex: 1 }}>{item.name}</AppText>
                  <AppText size="xl" color={colors.textLighter}>›</AppText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id, item.name)} activeOpacity={0.7}>
                  <AppText size="md" color="#DC2626">删除</AppText>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      />

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push({ pathname: "/category-edit", params: { type: activeTab } })}
          activeOpacity={0.8}
        >
          <AppText size="2xl" weight="semibold" color={colors.white}>+ 添加分类</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radii.sm,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  tabRow: { flexDirection: "row", gap: 12, padding: spacing.xl },
  tab: {
    flex: 1, paddingVertical: 12, borderRadius: radii.md,
    backgroundColor: colors.creamDark, alignItems: "center",
  },
  tabActiveExpense: { backgroundColor: colors.coral },
  tabActiveIncome: { backgroundColor: colors.sage },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
  row: {
    backgroundColor: colors.white, borderRadius: radii.md,
    marginBottom: spacing.md, ...shadows.sm, overflow: "hidden",
  },
  rowContent: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: spacing.xl,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: radii.md,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  deleteBtn: {
    borderTopWidth: 1, borderTopColor: colors.creamDark,
    paddingVertical: 10, alignItems: "center",
  },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.xl, paddingTop: 12,
    backgroundColor: colors.cream,
  },
  addBtn: {
    height: 48, borderRadius: radii.md, backgroundColor: colors.sage,
    alignItems: "center", justifyContent: "center", ...shadows.md,
  },
});

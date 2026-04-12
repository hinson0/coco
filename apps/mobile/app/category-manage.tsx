// 分类列表管理页面 — 支出/收入 Tab 切换，预设保护，软删除
import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalCategories } from "../hooks/useLocalCategories";
import { AppText } from "../components/ui/AppText";
import { colors, radii, spacing, shadows } from "../constants/theme";
import type { TransactionType } from "@coco/shared";

export default function CategoryManageScreen() {
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { data: categories = [] } = useLocalCategories();
  const [activeTab, setActiveTab] = useState<TransactionType>(
    type === "income" ? "income" : "expense",
  );

  const filtered = categories.filter((c) => c.type === activeTab);
  const defaultCategories = filtered.filter((c) => c.is_default);
  const customCategories = filtered.filter((c) => !c.is_default);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          activeOpacity={0.75}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">
          分类管理
        </AppText>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "expense" && styles.tabActiveExpense,
          ]}
          onPress={() => setActiveTab("expense")}
          activeOpacity={0.7}
        >
          <AppText
            size="xl"
            weight="semibold"
            color={activeTab === "expense" ? colors.white : colors.textLight}
          >
            支出
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "income" && styles.tabActiveIncome]}
          onPress={() => setActiveTab("income")}
          activeOpacity={0.7}
        >
          <AppText
            size="xl"
            weight="semibold"
            color={activeTab === "income" ? colors.white : colors.textLight}
          >
            收入
          </AppText>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {/* 默认分类 — 网格展示 */}
        {defaultCategories.length > 0 && (
          <>
            <AppText
              size="md"
              color={colors.textLighter}
              weight="semibold"
              style={styles.sectionLabel}
            >
              预设分类
            </AppText>
            <View style={styles.grid}>
              {defaultCategories.map((item) => (
                <View key={item.id} style={styles.gridItem}>
                  <View style={styles.gridIcon}>
                    <AppText style={{ fontSize: 24 }}>{item.icon}</AppText>
                  </View>
                  <AppText
                    size="sm"
                    weight="medium"
                    color={colors.textLight}
                    numberOfLines={1}
                  >
                    {item.name}
                  </AppText>
                </View>
              ))}
            </View>
          </>
        )}

        {/* 自定义分类 — 网格展示，点击进入编辑页 */}
        {customCategories.length > 0 && (
          <>
            <AppText
              size="md"
              color={colors.textLighter}
              weight="semibold"
              style={styles.sectionLabel}
            >
              自定义分类
            </AppText>
            <View style={styles.grid}>
              {customCategories.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.gridItem}
                  onPress={() =>
                    router.push({
                      pathname: "/category-edit",
                      params: {
                        id: item.id,
                        name: item.name,
                        icon: item.icon,
                        type: item.type,
                      },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.gridIcon}>
                    <AppText style={{ fontSize: 24 }}>{item.icon}</AppText>
                  </View>
                  <AppText
                    size="sm"
                    weight="medium"
                    color={colors.textLight}
                    numberOfLines={1}
                  >
                    {item.name}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() =>
            router.push({
              pathname: "/category-edit",
              params: { type: activeTab },
            })
          }
          activeOpacity={0.8}
        >
          <AppText size="2xl" weight="semibold" color={colors.white}>
            + 添加分类
          </AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.cream,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...shadows.md,
  },
  backArrow: { fontSize: 18, color: colors.text, lineHeight: 22 },
  tabRow: { flexDirection: "row", gap: 12, padding: spacing.xl },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: colors.creamDark,
    alignItems: "center",
  },
  tabActiveExpense: { backgroundColor: colors.coral },
  tabActiveIncome: { backgroundColor: colors.sage },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
  sectionLabel: { marginBottom: spacing.md, marginTop: spacing.sm },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: spacing.xl,
  },
  gridItem: {
    width: "20%",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  gridIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    ...shadows.sm,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: 12,
    backgroundColor: colors.cream,
  },
  addBtn: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },
});

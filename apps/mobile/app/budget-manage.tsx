// apps/mobile/app/budget-manage.tsx
// 预算管理列表页面：总预算卡片 + 分类预算列表 + 进度条
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGlobalBudget,
  useCategoryBudgets,
  useDeleteBudget,
} from "../hooks/useLocalBudgets";
import { useLocalCategories } from "../hooks/useLocalCategories";
import { useMonthlyTransactions } from "../hooks/useLocalTransactions";
import { AppText } from "../components/ui/AppText";
import { Card } from "../components/ui/Card";
import { colors, radii, spacing, shadows } from "../constants/theme";

export default function BudgetManageScreen() {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const { data: globalBudget } = useGlobalBudget();
  const { data: categoryBudgets = [] } = useCategoryBudgets();
  const { data: categories = [] } = useLocalCategories();
  const { data: monthlyTx = [] } = useMonthlyTransactions(
    now.getFullYear(),
    now.getMonth(),
  );
  const { mutateAsync: deleteBudget } = useDeleteBudget();

  const totalExpense = monthlyTx
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const getCategoryExpense = (categoryId: string) =>
    monthlyTx
      .filter((t) => t.type === "expense" && t.category_id === categoryId)
      .reduce((sum, t) => sum + t.amount, 0);

  const getCategoryInfo = (categoryId: string | null) =>
    categories.find((c) => c.id === categoryId);

  const handleDeleteBudget = (id: string, name: string) => {
    Alert.alert("删除预算", `确定要删除"${name}"的预算吗？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => deleteBudget(id) },
    ]);
  };

  const categoryBudgetTotal = categoryBudgets.reduce(
    (sum, b) => sum + b.amount,
    0,
  );
  const isCategoryOverBudget =
    !!globalBudget && categoryBudgetTotal > globalBudget.amount;
  const overBudgetCategoryNames = categoryBudgets
    .map((b) => getCategoryInfo(b.category_id)?.name ?? "未知")
    .join("、");

  const globalProgress = globalBudget
    ? Math.min(totalExpense / globalBudget.amount, 1)
    : 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          activeOpacity={0.75}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">
          预算设置
        </AppText>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={categoryBudgets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Global budget card */}
            <TouchableOpacity
              onPress={() => router.push("/budget-setting")}
              activeOpacity={0.8}
            >
              <Card style={styles.globalCard}>
                <AppText size="md" color={colors.textLighter}>
                  总预算 (月)
                </AppText>
                <AppText size="5xl" weight="bold" style={{ marginTop: 4 }}>
                  {globalBudget
                    ? `¥ ${globalBudget.amount.toLocaleString()}`
                    : "点击设置"}
                </AppText>
                {globalBudget && (
                  <>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${globalProgress * 100}%` },
                        ]}
                      />
                    </View>
                    <AppText
                      size="sm"
                      color={colors.textLighter}
                      style={{ marginTop: 4 }}
                    >
                      已用 ¥{totalExpense.toFixed(0)} / ¥
                      {globalBudget.amount.toFixed(0)}
                    </AppText>
                    {isCategoryOverBudget && (
                      <AppText
                        size="sm"
                        weight="medium"
                        color={colors.coral}
                        style={styles.overBudgetText}
                      >
                        ⚠ {overBudgetCategoryNames} 合计 ¥
                        {categoryBudgetTotal.toLocaleString()} 超出总预算
                      </AppText>
                    )}
                  </>
                )}
              </Card>
            </TouchableOpacity>

            <AppText
              size="xl"
              weight="semibold"
              color={colors.textLight}
              style={styles.sectionTitle}
            >
              分类预算
            </AppText>
          </>
        }
        renderItem={({ item }) => {
          const cat = getCategoryInfo(item.category_id);
          const spent = item.category_id
            ? getCategoryExpense(item.category_id)
            : 0;
          const progress = Math.min(spent / item.amount, 1);
          return (
            <TouchableOpacity
              style={styles.budgetRow}
              onPress={() =>
                router.push({
                  pathname: "/budget-category-edit",
                  params: {
                    id: item.id,
                    categoryId: item.category_id ?? "",
                    amount: String(item.amount),
                  },
                })
              }
              onLongPress={() =>
                handleDeleteBudget(item.id, cat?.name ?? "未知")
              }
              activeOpacity={0.7}
            >
              <View style={styles.budgetIcon}>
                <AppText style={{ fontSize: 22 }}>{cat?.icon ?? "📦"}</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.budgetInfo}>
                  <AppText size="xl" weight="medium">
                    {cat?.name ?? "未知分类"}
                  </AppText>
                  <AppText size="md" color={colors.textLight}>
                    ¥{spent.toFixed(0)} / ¥{item.amount.toFixed(0)}
                  </AppText>
                </View>
                <View style={styles.progressTrackSmall}>
                  <View
                    style={[
                      styles.progressFillSmall,
                      { width: `${progress * 100}%` },
                    ]}
                  />
                </View>
              </View>
              <AppText size="xl" color={colors.textLighter}>
                ›
              </AppText>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/budget-category-edit")}
            activeOpacity={0.8}
          >
            <AppText size="2xl" weight="semibold" color={colors.white}>
              + 添加分类预算
            </AppText>
          </TouchableOpacity>
        }
      />
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
  listContent: { padding: spacing.xl, paddingBottom: 40 },
  globalCard: { marginBottom: spacing.xl },
  overBudgetText: { marginTop: spacing.sm },
  progressTrack: {
    height: 6,
    backgroundColor: colors.creamDark,
    borderRadius: 3,
    marginTop: 12,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sage,
  },
  sectionTitle: { marginBottom: spacing.lg },
  budgetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.xl,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  budgetIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  budgetInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progressTrackSmall: {
    height: 4,
    backgroundColor: colors.creamDark,
    borderRadius: 2,
  },
  progressFillSmall: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.honey,
  },
  addBtn: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
    ...shadows.md,
  },
});

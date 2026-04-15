// apps/mobile/app/budget-category-edit.tsx
// 分类预算添加/编辑页面：分类选择 + 金额输入
import { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Keyboard,
  Animated,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { QK } from "../lib/queryKeys";
import {
  useCreateBudget,
  useUpdateBudget,
  useCategoryBudgets,
  useGlobalBudget,
} from "../hooks/useLocalBudgets";
import { useLocalCategories } from "../hooks/useLocalCategories";
import { AppText } from "../components/ui/AppText";
import { colors, radii, spacing, shadows } from "../constants/theme";

export default function BudgetCategoryEditScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    categoryId?: string;
    amount?: string;
  }>();
  const isEdit = !!params.id;

  const qc = useQueryClient();
  const { data: categories = [] } = useLocalCategories();
  const { data: existingBudgets = [] } = useCategoryBudgets();
  const { mutateAsync: createBudget } = useCreateBudget();
  const { mutateAsync: updateBudget } = useUpdateBudget();
  const { data: globalBudget } = useGlobalBudget();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    params.categoryId || null,
  );
  const [amount, setAmount] = useState(params.amount ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const amountRef = useRef<TextInput>(null);
  const warningAnim = useRef(new Animated.Value(0)).current;

  const otherCategorySum = existingBudgets
    .filter((b) => b.id !== params.id)
    .reduce((sum, b) => sum + b.amount, 0);
  const currentAmount = parseFloat(amount) || 0;
  const categoryTotal = otherCategorySum + currentAmount;
  const isOverBudget = !!globalBudget && categoryTotal > globalBudget.amount;

  useEffect(() => {
    Animated.timing(warningAnim, {
      toValue: isOverBudget ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isOverBudget]);

  // 过滤掉已有预算的分类（编辑时排除自身）
  const usedCategoryIds = new Set(
    existingBudgets.filter((b) => b.id !== params.id).map((b) => b.category_id),
  );
  const availableCategories = categories.filter(
    (c) => c.type === "expense" && !usedCategoryIds.has(c.id),
  );

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardHeight(0),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => amountRef.current?.focus(), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("请输入有效金额");
      return;
    }
    if (!isEdit && !selectedCategoryId) {
      Alert.alert("请选择分类");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateBudget({ id: params.id!, amount: numAmount });
      } else {
        const now = new Date();
        await createBudget({
          category_id: selectedCategoryId,
          amount: numAmount,
          period: "monthly",
          start_date: new Date(
            now.getFullYear(),
            now.getMonth(),
            1,
          ).toISOString(),
        });
      }
      await qc.invalidateQueries({ queryKey: [QK.budgets] });
      router.back();
    } catch {
      Alert.alert("保存失败", "请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">
          {isEdit ? "编辑分类预算" : "添加分类预算"}
        </AppText>
        <View style={{ width: 36 }} />
      </View>

      {/* Category selector (only for new) */}
      {!isEdit && (
        <View style={styles.section}>
          <AppText
            size="md"
            color={colors.textLighter}
            style={{ marginBottom: 10 }}
          >
            选择分类
          </AppText>
          <FlatList
            horizontal
            data={availableCategories}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  item.id === selectedCategoryId && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategoryId(item.id)}
                activeOpacity={0.7}
              >
                <AppText style={{ fontSize: 20 }}>{item.icon}</AppText>
                <AppText
                  size="md"
                  weight="medium"
                  color={
                    item.id === selectedCategoryId ? colors.white : colors.text
                  }
                >
                  {item.name}
                </AppText>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Amount */}
      <View style={styles.section}>
        <AppText
          size="md"
          color={colors.textLighter}
          style={{ marginBottom: 10 }}
        >
          预算金额
        </AppText>
        <View style={styles.amountBox}>
          <AppText style={styles.amountPrefix}>¥</AppText>
          <TextInput
            ref={amountRef}
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={colors.textLighter}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {/* Over-budget warning */}
      {globalBudget && (
        <Animated.View
          style={[
            styles.overBudgetCard,
            {
              opacity: warningAnim,
              transform: [
                {
                  translateY: warningAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-8, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents={isOverBudget ? "auto" : "none"}
        >
          <AppText size="md" weight="medium" color={colors.coral}>
            ⚠ 分类预算合计 ¥{categoryTotal.toLocaleString()}
          </AppText>
          <AppText size="sm" color={colors.coral}>
            已超出总预算 ¥{globalBudget.amount.toLocaleString()}
          </AppText>
        </Animated.View>
      )}

      {/* Save button */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom:
              (keyboardHeight > 0 ? keyboardHeight + 16 : insets.bottom) + 12,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <AppText size="2xl" weight="semibold" color={colors.white}>
              保存
            </AppText>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.cream,
  },
  categoryChipActive: { backgroundColor: colors.sage },
  amountBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cream,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  amountPrefix: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textLighter,
    marginRight: 4,
  },
  amountInput: { flex: 1, fontSize: 36, fontWeight: "700", color: colors.text },
  overBudgetCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.coralPale,
    borderRadius: radii.md,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.creamDark,
  },
  saveBtn: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },
});

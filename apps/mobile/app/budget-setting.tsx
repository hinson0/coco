import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalBudgets, useCreateBudget, useUpdateBudget } from "../hooks/useLocalBudgets";
import { colors, radii, shadows, spacing } from "../constants/theme";

export default function BudgetSettingScreen() {
  const insets = useSafeAreaInsets();
  const { data: budgets = [] } = useLocalBudgets();
  const { mutateAsync: createBudget } = useCreateBudget();
  const { mutateAsync: updateBudget } = useUpdateBudget();

  const existingBudget = budgets.find(b => b.period === "monthly" && b.category_id === null)
    ?? budgets.find(b => b.period === "monthly");

  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef<TextInput>(null);

  useEffect(() => {
    if (existingBudget) {
      setAmount(String(existingBudget.amount));
    }
  }, [existingBudget?.id]);

  useEffect(() => {
    const timer = setTimeout(() => amountRef.current?.focus(), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("请输入有效金额");
      return;
    }

    setSubmitting(true);
    try {
      if (existingBudget) {
        await updateBudget({ id: existingBudget.id, amount: numAmount });
      } else {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        await createBudget({
          category_id: null,
          amount: numAmount,
          period: "monthly",
          start_date: startDate,
        });
      }
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>设置本月预算</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.hint}>
          {existingBudget ? "修改你的月度预算额度" : "设置一个月度预算来管理支出"}
        </Text>

        <View style={styles.amountBox}>
          <Text style={styles.amountPrefix}>¥</Text>
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

      {/* Bottom save button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, submitting && styles.saveBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.saveBtnText}>{existingBudget ? "保存修改" : "保存"}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
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
  backArrow: {
    fontSize: 18,
    color: colors.text,
    lineHeight: 22,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  body: {
    flex: 1,
    padding: spacing.xl,
  },
  hint: {
    fontSize: 14,
    color: colors.textLighter,
    marginBottom: 24,
    textAlign: "center",
  },
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
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: "700",
    color: colors.text,
  },
  bottomBar: {
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
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});

import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Keyboard, ActivityIndicator, Platform, Image, type ImageSourcePropType } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CategoryPicker } from "../components/CategoryPicker";
import { useLocalCategories } from "../hooks/useLocalCategories";
import { useCreateTransaction, useUpdateTransaction } from "../hooks/useLocalTransactions";
import { useAccounts } from "../hooks/useLocalAccounts";
import { useAddChatMessage } from "../hooks/useLocalChatMessages";
import { useOfflineContext } from "../lib/offline-context";
import { useQueryClient } from "@tanstack/react-query";
import { AppText } from "../components/ui/AppText";
import { colors, radii, shadows, spacing } from "../constants/theme";

const BRAND_ICON_MAP: Record<string, ImageSourcePropType> = {
  wechat: require("../assets/images/wechat.png"),
  alipay: require("../assets/images/alipay.png"),
};

// ─── Date helpers ────────────────────────────────────────────────────────────

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function formatDateLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isSame = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const base = `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}`;
  if (isSame(d, today)) return `${base}  今天`;
  if (isSame(d, yesterday)) return `${base}  昨天`;
  return base;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ManualEntryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ txId?: string; txData?: string; msgId?: string; ocrNote?: string }>();
  const { db } = useOfflineContext();
  const qc = useQueryClient();
  const { data: categories = [] } = useLocalCategories();
  const { mutateAsync: createTransaction } = useCreateTransaction();
  const { mutateAsync: updateTransaction } = useUpdateTransaction();
  const { mutateAsync: addMessage } = useAddChatMessage();
  const { data: accounts = [] } = useAccounts();

  const transaction = params.txData ? JSON.parse(params.txData) : undefined;
  const isEdit = !!transaction;

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState(() => params.ocrNote ?? "");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [date, setDate] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const amountRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const DEFAULT_NAMES: Record<string, string> = { expense: "购物", income: "工资" };

  useEffect(() => {
    if (transaction) {
      setAmount(String(transaction.amount));
      setNote(transaction.note || "");
      setType(transaction.type);
      setCategoryId(transaction.category_id);
      setAccountId(transaction.account_id ?? null);
      setDate(new Date(transaction.occurred_at));
    } else {
      const match = categories.find((c: any) => c.type === "expense" && c.name === DEFAULT_NAMES["expense"]);
      if (match) setCategoryId(match.id);
    }
  }, [transaction?.id, categories.length]);

  useEffect(() => {
    if (!isEdit) {
      const match = categories.find((c: any) => c.type === type && c.name === DEFAULT_NAMES[type]);
      if (match) setCategoryId(match.id);
    }
  }, [type, categories, isEdit]);

  useEffect(() => {
    const timer = setTimeout(() => amountRef.current?.focus(), 500);
    return () => clearTimeout(timer);
  }, []);

  function shiftDate(offset: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + offset);
    if (next > new Date()) return;
    setDate(next);
  }

  function handleDateChange(_event: any, selectedDate?: Date) {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  }

  // ── Submit ──
  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("请输入有效金额");
      return;
    }
    if (!categoryId) {
      Alert.alert("请选择分类");
      return;
    }

    setSubmitting(true);
    try {
      const category = categories.find((c: any) => c.id === categoryId);
      const categoryName = category?.name ?? "其他";

      if (isEdit) {
        await updateTransaction({ id: transaction.id, amount: numAmount, note, type, occurred_at: date.toISOString(), category_id: categoryId, account_id: accountId });
        if (db && params.msgId) {
          const newContent = JSON.stringify({ id: transaction.id, amount: numAmount, type, note, category_id: categoryId, occurred_at: date.toISOString() });
          await db.runAsync("UPDATE chat_messages SET content = ? WHERE id = ?", newContent, params.msgId);
          qc.invalidateQueries({ queryKey: ["chat-messages"] });
        }
      } else {
        const txId = await createTransaction({ amount: numAmount, note, type, occurred_at: date.toISOString(), category_id: categoryId, source: "manual", account_id: accountId });
        await addMessage({ role: "user", content_type: "text", content: `手动记账: ${note || categoryName} ¥${numAmount}` });
        await addMessage({ role: "assistant", content_type: "bill_card", content: JSON.stringify({ id: txId, amount: numAmount, type, note, category_id: categoryId, occurred_at: date.toISOString() }), transaction_id: txId });
      }
      router.back();
    } catch {
      Alert.alert(isEdit ? "修改失败" : "提交失败", "请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const bottomPadding = keyboardHeight > 0 ? keyboardHeight + 16 : insets.bottom;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? "修改记账" : "手动记账"}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Body ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Type toggle */}
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBtn, type === "expense" && styles.typeBtnExpense]}
            onPress={() => setType("expense")}
            activeOpacity={0.7}
          >
            <Text style={[styles.typeText, type === "expense" && styles.typeTextActive]}>支出</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, type === "income" && styles.typeBtnIncome]}
            onPress={() => setType("income")}
            activeOpacity={0.7}
          >
            <Text style={[styles.typeText, type === "income" && styles.typeTextActive]}>收入</Text>
          </TouchableOpacity>
        </View>

        {/* Amount */}
        <View style={styles.amountBox}>
          <Text style={styles.amountPrefix}>¥</Text>
          <TextInput
            ref={amountRef}
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.textLighter}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Category Picker */}
        <CategoryPicker selectedId={categoryId} onSelect={setCategoryId} type={type} />

        {/* Account selector */}
        {accounts.length > 0 && (
          <View style={styles.accountSection}>
            <AppText size="md" color={colors.textLighter} style={{ marginBottom: 8 }}>账户（可选）</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity
                style={[styles.accountChip, accountId === null && styles.accountChipActive]}
                onPress={() => setAccountId(null)}
                activeOpacity={0.7}
              >
                <AppText size="md" weight="medium" color={accountId === null ? colors.white : colors.textLight}>不选择</AppText>
              </TouchableOpacity>
              {accounts.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.accountChip, accountId === a.id && styles.accountChipActive]}
                  onPress={() => setAccountId(a.id)}
                  activeOpacity={0.7}
                >
                  {BRAND_ICON_MAP[a.icon] ? (
                    <Image source={BRAND_ICON_MAP[a.icon]} style={{ width: 16, height: 16 }} resizeMode="contain" />
                  ) : (
                    <AppText style={{ fontSize: 16 }}>{a.icon}</AppText>
                  )}
                  <AppText size="md" weight="medium" color={accountId === a.id ? colors.white : colors.text}>{a.name}</AppText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Date selector — arrows + tappable center */}
        <View style={styles.dateCard}>
          <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.dateArrowBtn} activeOpacity={0.6}>
            <Text style={styles.dateArrow}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateLabelArea} activeOpacity={0.7}>
            <Text style={styles.dateIcon}>📅</Text>
            <Text style={styles.dateText}>{formatDateLabel(date)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => shiftDate(1)}
            style={styles.dateArrowBtn}
            activeOpacity={isToday(date) ? 1 : 0.6}
            disabled={isToday(date)}
          >
            <Text style={[styles.dateArrow, isToday(date) && { opacity: 0.3 }]}>›</Text>
          </TouchableOpacity>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "calendar"}
            maximumDate={new Date()}
            onChange={handleDateChange}
            locale="zh-CN"
          />
        )}
        {showDatePicker && Platform.OS === "ios" && (
          <TouchableOpacity style={styles.dateConfirmBtn} onPress={() => setShowDatePicker(false)} activeOpacity={0.7}>
            <Text style={styles.dateConfirmText}>确定</Text>
          </TouchableOpacity>
        )}

        {/* Note */}
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="添加备注..."
          placeholderTextColor={colors.textLighter}
          multiline
          textAlignVertical="top"
          onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
        />
      </ScrollView>

      {/* ── Bottom save button ── */}
      <View style={[styles.bottomBar, { paddingBottom: bottomPadding + 12 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, submitting && styles.saveBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.saveBtnText}>{isEdit ? "保存修改" : "保存"}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },

  // Header
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

  // Body
  body: {
    flex: 1,
    padding: spacing.xl,
  },

  // Type toggle
  typeRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.md,
    backgroundColor: colors.cream,
    alignItems: "center",
  },
  typeBtnExpense: {
    backgroundColor: colors.coral,
  },
  typeBtnIncome: {
    backgroundColor: colors.sage,
  },
  typeText: {
    color: colors.textLight,
    fontSize: 15,
    fontWeight: "600",
  },
  typeTextActive: {
    color: colors.white,
  },

  // Amount
  amountBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cream,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    marginBottom: 20,
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

  // Date selector
  dateCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cream,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.creamDark,
    marginTop: 20,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  dateArrowBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
  },
  dateArrow: {
    fontSize: 24,
    color: colors.text,
    fontWeight: "600",
  },
  dateLabelArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dateIcon: {
    fontSize: 16,
  },
  dateText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  dateConfirmBtn: {
    alignSelf: "flex-end",
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: colors.sage,
    borderRadius: radii.sm,
  },
  dateConfirmText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
  },

  // Note
  noteInput: {
    backgroundColor: colors.cream,
    color: colors.text,
    padding: 14,
    borderRadius: radii.md,
    fontSize: 14,
    marginTop: 20,
    minHeight: 60,
  },

  // Bottom save button
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

  // Account selector
  accountSection: {
    marginTop: 20,
  },
  accountChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radii.md, backgroundColor: colors.cream,
  },
  accountChipActive: {
    backgroundColor: colors.sage,
  },
});

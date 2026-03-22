import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Keyboard } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryPicker } from "../components/CategoryPicker";
import { useLocalCategories } from "../hooks/useLocalCategories";
import { useCreateTransaction, useUpdateTransaction } from "../hooks/useLocalTransactions";
import { useAddChatMessage } from "../hooks/useLocalChatMessages";
import { useOfflineContext } from "../lib/offline-context";
import { useQueryClient } from "@tanstack/react-query";
import { colors } from "../constants/theme";

export default function ManualEntryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ txId?: string; txData?: string; msgId?: string }>();
  const { db } = useOfflineContext();
  const qc = useQueryClient();
  const { data: categories = [] } = useLocalCategories();
  const { mutateAsync: createTransaction } = useCreateTransaction();
  const { mutateAsync: updateTransaction } = useUpdateTransaction();
  const { mutateAsync: addMessage } = useAddChatMessage();

  // Parse transaction from params for edit mode
  const transaction = params.txData ? JSON.parse(params.txData) : undefined;
  const isEdit = !!transaction;

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [date, setDate] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const amountRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const DEFAULT_NAMES: Record<string, string> = { expense: "购物", income: "工资" };

  // Pre-fill for edit or set defaults for new
  useEffect(() => {
    if (transaction) {
      setAmount(String(transaction.amount));
      setNote(transaction.note || "");
      setType(transaction.type);
      setCategoryId(transaction.category_id);
      setDate(new Date(transaction.occurred_at));
    } else {
      const defaultName = DEFAULT_NAMES["expense"];
      const match = categories.find((c: any) => c.type === "expense" && c.name === defaultName);
      if (match) setCategoryId(match.id);
    }
  }, [transaction?.id, categories.length]);

  useEffect(() => {
    if (!isEdit) {
      const defaultName = DEFAULT_NAMES[type];
      const match = categories.find((c: any) => c.type === type && c.name === defaultName);
      if (match) setCategoryId(match.id);
    }
  }, [type, categories, isEdit]);

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
    if (!categoryId) {
      Alert.alert("请选择分类");
      return;
    }

    setSubmitting(true);
    try {
      const category = categories.find((c: any) => c.id === categoryId);
      const categoryName = category?.name ?? "其他";

      if (isEdit) {
        await updateTransaction({ id: transaction.id, amount: numAmount, note, type, occurred_at: date.toISOString(), category_id: categoryId });
        // Update the chat message snapshot so the card reflects the edit
        if (db && params.msgId) {
          const newContent = JSON.stringify({ id: transaction.id, amount: numAmount, type, note, category_id: categoryId, occurred_at: date.toISOString() });
          await db.runAsync("UPDATE chat_messages SET content = ? WHERE id = ?", newContent, params.msgId);
          qc.invalidateQueries({ queryKey: ["chat-messages"] });
        }
      } else {
        const txId = await createTransaction({ amount: numAmount, note, type, occurred_at: date.toISOString(), category_id: categoryId, source: "manual" });
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

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>取消</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? "修改记账" : "手动记账"}</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={submitting}>
          <Text style={[styles.save, submitting && { opacity: 0.5 }]}>保存</Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: keyboardHeight > 0 ? keyboardHeight : insets.bottom + 20 }}
      >
        {/* Type toggle */}
        <View style={styles.typeRow}>
          <TouchableOpacity style={[styles.typeBtn, type === "expense" && styles.typeBtnActive]} onPress={() => setType("expense")}>
            <Text style={[styles.typeText, type === "expense" && styles.typeTextActive]}>支出</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeBtn, type === "income" && styles.typeBtnIncome]} onPress={() => setType("income")}>
            <Text style={[styles.typeText, type === "income" && styles.typeTextActive]}>收入</Text>
          </TouchableOpacity>
        </View>

        {/* Amount */}
        <TextInput
          ref={amountRef}
          style={styles.amountInput}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor="#cbd5e1"
          keyboardType="decimal-pad"
        />

        {/* Category Picker */}
        <CategoryPicker selectedId={categoryId} onSelect={setCategoryId} type={type} />

        {/* Date quick select */}
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>选择日期</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[0, -1, -2].map((offset) => {
              const d = new Date();
              d.setDate(d.getDate() + offset);
              const label = offset === 0 ? "今天" : offset === -1 ? "昨天" : "前天";
              const isSelected = date.toDateString() === d.toDateString();
              return (
                <TouchableOpacity key={offset} style={[styles.typeBtn, isSelected && styles.typeBtnActive]} onPress={() => setDate(d)}>
                  <Text style={[styles.typeText, isSelected && styles.typeTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Note */}
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="添加备注..."
          placeholderTextColor="#cbd5e1"
          onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  cancel: { color: "#94a3b8", fontSize: 16 },
  title: { color: "#1e293b", fontSize: 16, fontWeight: "600" },
  save: { color: colors.sage, fontSize: 16, fontWeight: "600" },
  body: { flex: 1, padding: 16 },
  typeRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  typeBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F0F2F5", alignItems: "center" },
  typeBtnActive: { backgroundColor: "#DC2626" },
  typeBtnIncome: { backgroundColor: "#059669" },
  typeText: { color: "#64748b", fontSize: 14, fontWeight: "600" },
  typeTextActive: { color: "#fff" },
  amountInput: { fontSize: 36, fontWeight: "700", color: "#1e293b", textAlign: "left", marginBottom: 20, padding: 16, backgroundColor: "#F0F2F5", borderRadius: 12 },
  noteInput: { backgroundColor: "#F0F2F5", color: "#1e293b", padding: 14, borderRadius: 12, fontSize: 14, marginTop: 16 },
});

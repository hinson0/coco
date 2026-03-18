import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, Keyboard } from "react-native";
import { apiFetch } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { CategoryPicker } from "./CategoryPicker";
import { useCategories } from "../hooks/useCategories";

interface Props {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSuccess?: (tx: any) => void;
}

export function ManualEntryForm({ visible, onClose, onSuccess }: Props) {
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
  const qc = useQueryClient();
  const { data: catData } = useCategories();
  const categories = catData?.data ?? [];

  const DEFAULT_NAMES: Record<string, string> = { expense: '购物', income: '工资' };

  useEffect(() => {
    const defaultName = DEFAULT_NAMES[type];
    const match = categories.find((c: any) => c.type === type && c.name === defaultName);
    if (match) setCategoryId(match.id);
  }, [type, categories]);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => amountRef.current?.focus(), 500);
      return () => clearTimeout(timer);
    }
  }, [visible]);

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
      const resp = await apiFetch<any>("/api/record/manual", {
        method: "POST",
        body: JSON.stringify({ amount: numAmount, note, type, occurred_at: date.toISOString(), category_id: categoryId }),
      });
      if (resp.success) {
        qc.invalidateQueries({ queryKey: ["transactions"] });
        onSuccess?.(resp.data);
        onClose();
        setAmount("");
        setNote("");
        setCategoryId(null);
      }
    } catch {
      Alert.alert("提交失败", "请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancel}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.title}>手动记账</Text>
            <TouchableOpacity onPress={handleSubmit} disabled={submitting}>
              <Text style={[styles.save, submitting && { opacity: 0.5 }]}>保存</Text>
            </TouchableOpacity>
          </View>
          <ScrollView ref={scrollRef} style={styles.body} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: keyboardHeight > 0 ? 20 : 10 }}>
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
            <TextInput ref={amountRef} style={styles.amountInput} value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor="#cbd5e1" keyboardType="decimal-pad" />
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
            <TextInput style={styles.noteInput} value={note} onChangeText={setNote} placeholder="添加备注..." placeholderTextColor="#cbd5e1" onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  cancel: { color: "#94a3b8", fontSize: 16 },
  title: { color: "#1e293b", fontSize: 16, fontWeight: "600" },
  save: { color: "#2D9B83", fontSize: 16, fontWeight: "600" },
  body: { padding: 16 },
  typeRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  typeBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F0F2F5", alignItems: "center" },
  typeBtnActive: { backgroundColor: "#DC2626" },
  typeBtnIncome: { backgroundColor: "#059669" },
  typeText: { color: "#64748b", fontSize: 14, fontWeight: "600" },
  typeTextActive: { color: "#fff" },
  amountInput: { fontSize: 36, fontWeight: "700", color: "#1e293b", textAlign: "left", marginBottom: 20, padding: 16, backgroundColor: "#F0F2F5", borderRadius: 12 },
  noteInput: { backgroundColor: "#F0F2F5", color: "#1e293b", padding: 14, borderRadius: 12, fontSize: 14, marginTop: 16 },
});

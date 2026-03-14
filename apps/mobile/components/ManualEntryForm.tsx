import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, ScrollView, Alert } from "react-native";
import { apiFetch } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";

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
  const qc = useQueryClient();

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("请输入有效金额");
      return;
    }

    setSubmitting(true);
    try {
      const resp = await apiFetch<any>("/api/record/manual", {
        method: "POST",
        body: JSON.stringify({ amount: numAmount, note, type, occurred_at: date.toISOString() }),
      });
      if (resp.success) {
        qc.invalidateQueries({ queryKey: ["transactions"] });
        onSuccess?.(resp.data);
        onClose();
        setAmount("");
        setNote("");
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
          <ScrollView style={styles.body}>
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
            <TextInput style={styles.amountInput} value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor="#64748b" keyboardType="decimal-pad" />
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
            <TextInput style={styles.noteInput} value={note} onChangeText={setNote} placeholder="添加备注..." placeholderTextColor="#64748b" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0f172a", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#1e293b" },
  cancel: { color: "#94a3b8", fontSize: 16 },
  title: { color: "#fff", fontSize: 16, fontWeight: "600" },
  save: { color: "#6366f1", fontSize: 16, fontWeight: "600" },
  body: { padding: 16 },
  typeRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  typeBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#1e293b", alignItems: "center" },
  typeBtnActive: { backgroundColor: "#ef4444" },
  typeBtnIncome: { backgroundColor: "#22c55e" },
  typeText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  typeTextActive: { color: "#fff" },
  amountInput: { fontSize: 36, fontWeight: "700", color: "#fff", textAlign: "center", marginBottom: 20, padding: 16, backgroundColor: "#1e293b", borderRadius: 12 },
  noteInput: { backgroundColor: "#1e293b", color: "#fff", padding: 14, borderRadius: 12, fontSize: 14, marginTop: 16 },
});

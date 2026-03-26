// apps/mobile/app/account-edit.tsx
// 账户添加/编辑页面：预设模板 + emoji 图标 + 类型选择 + 初始余额
import { useState, useEffect } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Keyboard } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCreateAccount, useUpdateAccount } from "../hooks/useLocalAccounts";
import { EmojiPicker } from "../components/shared/EmojiPicker";
import { AppText } from "../components/ui/AppText";
import { colors, radii, spacing, shadows } from "../constants/theme";
import type { AccountType } from "@coco/shared";

const PRESETS: { name: string; icon: string; type: AccountType }[] = [
  { name: "现金", icon: "💰", type: "cash" },
  { name: "银行卡", icon: "🏦", type: "bank" },
  { name: "微信", icon: "💚", type: "e_wallet" },
  { name: "支付宝", icon: "💙", type: "e_wallet" },
  { name: "信用卡", icon: "💳", type: "credit" },
];

const TYPE_LABELS: Record<AccountType, string> = {
  cash: "现金", bank: "银行卡", e_wallet: "电子钱包", credit: "信用卡", custom: "自定义",
};

export default function AccountEditScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; name?: string; icon?: string; type?: string; initialBalance?: string }>();
  const isEdit = !!params.id;

  const { mutateAsync: createAccount } = useCreateAccount();
  const { mutateAsync: updateAccount } = useUpdateAccount();

  const [name, setName] = useState(params.name ?? "");
  const [icon, setIcon] = useState(params.icon ?? "💰");
  const [type, setType] = useState<AccountType>((params.type as AccountType) ?? "cash");
  const [initialBalance, setInitialBalance] = useState(params.initialBalance ?? "0");
  const [submitting, setSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const handlePreset = (preset: typeof PRESETS[0]) => {
    setName(preset.name);
    setIcon(preset.icon);
    setType(preset.type);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("请输入账户名称");
      return;
    }
    const numBalance = parseFloat(initialBalance);
    if (isNaN(numBalance)) {
      Alert.alert("请输入有效金额");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateAccount({ id: params.id!, name: name.trim(), icon, type, initial_balance: numBalance });
      } else {
        await createAccount({ name: name.trim(), icon, type, initial_balance: numBalance });
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
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">{isEdit ? "编辑账户" : "添加账户"}</AppText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        {/* Presets (only for new) */}
        {!isEdit && (
          <View style={styles.section}>
            <AppText size="md" color={colors.textLighter} style={{ marginBottom: 10 }}>快速添加</AppText>
            <View style={styles.presetRow}>
              {PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.name}
                  style={[styles.presetChip, name === p.name && styles.presetChipActive]}
                  onPress={() => handlePreset(p)}
                  activeOpacity={0.7}
                >
                  <AppText style={{ fontSize: 18 }}>{p.icon}</AppText>
                  <AppText size="md" weight="medium"
                    color={name === p.name ? colors.white : colors.text}>
                    {p.name}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Icon */}
        <View style={styles.iconSection}>
          <TouchableOpacity onPress={() => setShowEmojiPicker(true)} activeOpacity={0.8}>
            <View style={styles.iconPreview}>
              <AppText style={{ fontSize: 36 }}>{icon}</AppText>
            </View>
          </TouchableOpacity>
          <AppText size="md" color={colors.sage} style={{ marginTop: 8 }}>点击更换图标</AppText>
        </View>

        {/* Fields */}
        <View style={styles.fieldCard}>
          {/* Name */}
          <View style={styles.field}>
            <AppText size="md" color={colors.textLighter} style={{ marginBottom: 6 }}>账户名称</AppText>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="输入账户名称"
              placeholderTextColor={colors.textLighter}
              maxLength={20}
            />
          </View>

          <View style={styles.fieldSep} />

          {/* Type */}
          <View style={styles.field}>
            <AppText size="md" color={colors.textLighter} style={{ marginBottom: 6 }}>账户类型</AppText>
            <View style={styles.typeRow}>
              {(Object.keys(TYPE_LABELS) as AccountType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, type === t && styles.typeChipActive]}
                  onPress={() => setType(t)}
                  activeOpacity={0.7}
                >
                  <AppText size="sm" weight="medium"
                    color={type === t ? colors.white : colors.textLight}>
                    {TYPE_LABELS[t]}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldSep} />

          {/* Initial balance */}
          <View style={styles.field}>
            <AppText size="md" color={colors.textLighter} style={{ marginBottom: 6 }}>初始余额</AppText>
            <View style={styles.balanceRow}>
              <AppText style={{ fontSize: 20, fontWeight: "700", color: colors.textLighter }}>¥</AppText>
              <TextInput
                style={styles.balanceInput}
                value={initialBalance}
                onChangeText={setInitialBalance}
                placeholder="0.00"
                placeholderTextColor={colors.textLighter}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <EmojiPicker
        visible={showEmojiPicker}
        onSelect={setIcon}
        onClose={() => setShowEmojiPicker(false)}
      />

      <View style={[styles.bottomBar, { paddingBottom: (keyboardHeight > 0 ? keyboardHeight + 16 : insets.bottom) + 12 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, submitting && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <AppText size="2xl" weight="semibold" color={colors.white}>保存</AppText>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radii.sm,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  body: { flex: 1 },
  section: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xxl },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  presetChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radii.md, backgroundColor: colors.cream,
  },
  presetChipActive: { backgroundColor: colors.sage },
  iconSection: { alignItems: "center", paddingVertical: 24 },
  iconPreview: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
    ...shadows.sm,
  },
  fieldCard: {
    marginHorizontal: spacing.xxl, backgroundColor: colors.cream,
    borderRadius: radii.md, overflow: "hidden",
  },
  field: { padding: spacing.xl },
  fieldSep: { height: 1, backgroundColor: colors.creamDark, marginHorizontal: spacing.xl },
  input: { fontSize: 16, color: colors.text, fontWeight: "500" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radii.sm, backgroundColor: colors.white,
  },
  typeChipActive: { backgroundColor: colors.sage },
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  balanceInput: { flex: 1, fontSize: 24, fontWeight: "700", color: colors.text },
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

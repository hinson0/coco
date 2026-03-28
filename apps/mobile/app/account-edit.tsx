// 账户添加/编辑页面 — 紧凑布局，键盘弹起时所有内容可见
import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Keyboard, Image, type ImageSourcePropType } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateAccount, useUpdateAccount, useDeleteAccount } from "../hooks/useLocalAccounts";
import { EmojiPicker } from "../components/shared/EmojiPicker";
import { AppText } from "../components/ui/AppText";
import { colors, radii, spacing, shadows } from "../constants/theme";
import type { AccountType } from "@coco/shared";

// 品牌图标资源
const BRAND_ICONS = {
  wechat: require("../assets/images/wechat.png"),
  alipay: require("../assets/images/alipay.png"),
} as const;

// 账户类型配置
interface TypeConfig {
  readonly emoji?: string;
  readonly brandIcon?: ImageSourcePropType;
  readonly label: string;
  readonly dbType: AccountType;
  readonly autoName?: string;
  readonly placeholder?: string;
}

const TYPE_OPTIONS: readonly TypeConfig[] = [
  { emoji: "🏦", label: "储蓄卡", dbType: "bank", placeholder: "建行 / 工行 / 招行 / 农行 / 交行 / 中行" },
  { emoji: "💳", label: "信用卡", dbType: "credit", placeholder: "建行 / 工行 / 招行 / 农行 / 交行 / 中行" },
  { brandIcon: BRAND_ICONS.wechat, label: "微信", dbType: "e_wallet", autoName: "微信" },
  { brandIcon: BRAND_ICONS.alipay, label: "支付宝", dbType: "e_wallet", autoName: "支付宝" },
  { emoji: "💰", label: "现金", dbType: "cash", autoName: "现金" },
  { emoji: "⚙️", label: "自定义", dbType: "custom", placeholder: "输入账户名称" },
];

function TypeIcon({ config, size = 14 }: { config: TypeConfig; size?: number }) {
  if (config.brandIcon) {
    return <Image source={config.brandIcon} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  return <AppText style={{ fontSize: size }}>{config.emoji}</AppText>;
}

export default function AccountEditScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; name?: string; icon?: string; type?: string; initialBalance?: string }>();
  const isEdit = !!params.id;

  const qc = useQueryClient();
  const { mutateAsync: createAccount } = useCreateAccount();
  const { mutateAsync: updateAccount } = useUpdateAccount();
  const { mutateAsync: deleteAccount } = useDeleteAccount();

  const initialTypeConfig = TYPE_OPTIONS.find((t) => t.dbType === params.type) ?? TYPE_OPTIONS[0];

  const [selectedType, setSelectedType] = useState<TypeConfig>(initialTypeConfig);
  const [name, setName] = useState(params.name ?? "");
  const [icon, setIcon] = useState(params.icon ?? initialTypeConfig.emoji ?? "📦");
  const [initialBalance, setInitialBalance] = useState(params.initialBalance ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const nameRef = useRef<TextInput>(null);
  const balanceRef = useRef<TextInput>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    if (!isEdit) {
      const ref = selectedType.autoName ? balanceRef : nameRef;
      const timer = setTimeout(() => ref.current?.focus(), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleTypeSelect = (config: TypeConfig) => {
    setSelectedType(config);
    setIcon(config.emoji ?? "📦");
    if (config.autoName) {
      setName(config.autoName);
      setTimeout(() => balanceRef.current?.focus(), 300);
    } else {
      setName("");
      setTimeout(() => nameRef.current?.focus(), 300);
    }
  };

  const handleDelete = () => {
    Alert.alert("删除账户", `确定要删除"${name}"吗？已有的交易记录不会受影响。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除", style: "destructive", onPress: async () => {
          await deleteAccount(params.id!);
          await qc.invalidateQueries({ queryKey: ["accounts"] });
          await qc.invalidateQueries({ queryKey: ["total-assets"] });
          router.back();
        }
      },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("请输入账户名称");
      return;
    }
    const numBalance = parseFloat(initialBalance || "0");
    if (isNaN(numBalance)) {
      Alert.alert("请输入有效金额");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateAccount({ id: params.id!, name: name.trim(), icon, type: selectedType.dbType, initial_balance: numBalance });
      } else {
        await createAccount({ name: name.trim(), icon, type: selectedType.dbType, initial_balance: numBalance });
      }
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      await qc.invalidateQueries({ queryKey: ["total-assets"] });
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
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.75}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">{isEdit ? "编辑账户" : "添加账户"}</AppText>
        {isEdit ? (
          <TouchableOpacity onPress={handleDelete} activeOpacity={0.7}>
            <AppText size="3xl">🗑️</AppText>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <View style={styles.body}>
        {/* 账户类型 chips */}
        <View style={styles.section}>
          <AppText size="sm" weight="semibold" color={colors.textLighter} style={styles.sectionLabel}>账户类型</AppText>
          <View style={styles.typeChips}>
            {TYPE_OPTIONS.map((config) => {
              const isActive = selectedType.label === config.label;
              return (
                <TouchableOpacity
                  key={config.label}
                  style={[styles.typeChip, isActive && styles.typeChipActive]}
                  onPress={() => !isEdit && handleTypeSelect(config)}
                  activeOpacity={isEdit ? 1 : 0.7}
                  disabled={isEdit}
                >
                  <TypeIcon config={config} size={14} />
                  <AppText size="sm" weight={isActive ? "semibold" : "medium"}
                    color={isActive ? colors.sage : colors.textLight}>
                    {config.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 紧凑表单：图标内联在名称行左侧 */}
        <View style={styles.formCard}>
          {/* 名称行：左侧图标 + 右侧名称输入 */}
          <View style={styles.formRow}>
            <TouchableOpacity onPress={() => setShowEmojiPicker(true)} activeOpacity={0.8}>
              <LinearGradient
                colors={[colors.sagePale, colors.coralPale]}
                style={styles.inlineIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <AppText style={{ fontSize: 26 }}>{icon}</AppText>
              </LinearGradient>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <AppText size="xs" weight="semibold" color={colors.textLighter} style={styles.fieldLabel}>账户名称</AppText>
              <TextInput
                ref={nameRef}
                style={styles.fieldInput}
                value={name}
                onChangeText={(text) => {
                  // 拦截换行符，跳转到金额输入框
                  if (text.includes("\n")) {
                    balanceRef.current?.focus();
                    return;
                  }
                  setName(text);
                }}
                placeholder={selectedType.placeholder ?? "输入账户名称"}
                placeholderTextColor={colors.creamDeeper}
                maxLength={20}
                editable={!selectedType.autoName || isEdit}
                multiline
                numberOfLines={1}
              />
            </View>
          </View>

          {/* 金额行：标签 + ¥ + 金额输入 同行 */}
          <View style={[styles.formRow, styles.formRowBorder]}>
            <View style={styles.balanceRow}>
              <AppText size="xs" weight="semibold" color={colors.textLighter} style={{ marginRight: 8 }}>初始余额</AppText>
              <AppText style={styles.balancePrefix}>¥</AppText>
              <TextInput
                ref={balanceRef}
                style={styles.balanceInput}
                value={initialBalance}
                onChangeText={setInitialBalance}
                placeholder="0.00"
                placeholderTextColor={colors.creamDeeper}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>
      </View>

      <EmojiPicker
        visible={showEmojiPicker}
        onSelect={setIcon}
        onClose={() => setShowEmojiPicker(false)}
      />

      {/* 底部保存按钮 */}
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
            <AppText size="2xl" weight="semibold" color={colors.white}>{isEdit ? "保存修改" : "保存"}</AppText>
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
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.creamDark,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: radii.md,
    backgroundColor: colors.white, alignItems: "center" as const, justifyContent: "center" as const,
    ...shadows.md,
  },
  backArrow: { fontSize: 18, color: colors.text, lineHeight: 22 },
  body: { flex: 1, paddingHorizontal: spacing.xxl },

  // Section
  section: { paddingTop: spacing.xl },
  sectionLabel: { marginBottom: 8 },

  // Type chips - 紧凑
  typeChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.xl },
  typeChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, backgroundColor: colors.cream,
    borderWidth: 1.5, borderColor: "transparent",
  },
  typeChipActive: {
    backgroundColor: colors.sagePale,
    borderColor: colors.sage,
  },

  // Form card
  formCard: {
    backgroundColor: colors.cream,
    borderRadius: radii.md, overflow: "hidden",
  },
  formRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14,
  },
  formRowBorder: {
    borderTopWidth: 1, borderTopColor: colors.creamDark,
  },

  // Inline icon
  inlineIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    ...shadows.sm,
  },

  // Fields
  fieldLabel: { marginBottom: 2, letterSpacing: 0.3 },
  fieldInput: { fontSize: 15, color: colors.text, fontWeight: "500" },

  // Balance - 同行布局
  balanceRow: { flex: 1, flexDirection: "row", alignItems: "baseline" },
  balancePrefix: { fontSize: 18, fontWeight: "700", color: colors.textLighter, marginRight: 4 },
  balanceInput: { flex: 1, fontSize: 24, fontWeight: "700", color: colors.text },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: spacing.xl, paddingTop: 10,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.creamDark,
  },
  saveBtn: {
    height: 46, borderRadius: radii.md, backgroundColor: colors.sage,
    alignItems: "center", justifyContent: "center", ...shadows.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
});

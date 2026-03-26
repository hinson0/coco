// 账户添加/编辑页面 — 类型选择 + 动态 placeholder + emoji 图标 + 初始余额
import { useState, useEffect, useRef } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Keyboard, Image, type ImageSourcePropType } from "react-native";
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

// 账户类型配置：图标、标签、默认名称、placeholder
interface TypeConfig {
  readonly emoji?: string;                   // emoji 图标（普通类型）
  readonly brandIcon?: ImageSourcePropType;  // 品牌图标（微信/支付宝）
  readonly label: string;
  readonly dbType: AccountType;
  readonly autoName?: string;
  readonly placeholder?: string;
}

const TYPE_OPTIONS: readonly TypeConfig[] = [
  { emoji: "🏦", label: "储蓄卡", dbType: "bank", placeholder: "建行 / 工行 / 招行 / 农行 / 交行 / 中行 / 邮政" },
  { emoji: "💳", label: "信用卡", dbType: "credit", placeholder: "建行 / 工行 / 招行 / 农行 / 交行 / 中行 / 邮政" },
  { brandIcon: BRAND_ICONS.wechat, label: "微信", dbType: "e_wallet", autoName: "微信" },
  { brandIcon: BRAND_ICONS.alipay, label: "支付宝", dbType: "e_wallet", autoName: "支付宝" },
  { emoji: "💰", label: "现金", dbType: "cash", autoName: "现金" },
  { emoji: "⚙️", label: "自定义", dbType: "custom", placeholder: "输入账户名称" },
];

// 渲染类型图标（品牌图片 or emoji）
function TypeIcon({ config, size = 16 }: { config: TypeConfig; size?: number }) {
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

  // 编辑时从 params 匹配当前类型配置
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

  // 新建时自动聚焦：有 autoName 的聚焦金额，否则聚焦名称
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
      // 名称自动填充且不可编辑，聚焦到金额
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <AppText size="2xl">←</AppText>
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

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 80 }}>
        {/* 账户类型选择 */}
        <View style={styles.section}>
          <AppText size="md" weight="semibold" color={colors.textLighter} style={styles.sectionLabel}>账户类型</AppText>
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
                  <TypeIcon config={config} size={18} />
                  <AppText size="md" weight={isActive ? "semibold" : "medium"}
                    color={isActive ? colors.sage : colors.textLight}>
                    {config.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 图标 */}
        <View style={styles.iconSection}>
          <TouchableOpacity onPress={() => setShowEmojiPicker(true)} activeOpacity={0.8}>
            <LinearGradient
              colors={[colors.sagePale, colors.coralPale]}
              style={styles.iconPreview}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <AppText style={{ fontSize: 36 }}>{icon}</AppText>
            </LinearGradient>
          </TouchableOpacity>
          <AppText size="md" color={colors.sage} style={{ marginTop: 8 }}>点击更换图标</AppText>
        </View>

        {/* 表单 */}
        <View style={styles.formCard}>
          {/* 账户名称 */}
          <View style={styles.formField}>
            <AppText size="sm" weight="semibold" color={colors.textLighter} style={styles.fieldLabel}>账户名称</AppText>
            <TextInput
              ref={nameRef}
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholder={selectedType.placeholder ?? "输入账户名称"}
              placeholderTextColor={colors.creamDeeper}
              maxLength={20}
              editable={!selectedType.brandIcon || isEdit}
            />
          </View>

          {/* 分隔线 */}
          <View style={styles.fieldSep} />

          {/* 初始余额 */}
          <View style={styles.formField}>
            <AppText size="sm" weight="semibold" color={colors.textLighter} style={styles.fieldLabel}>初始余额</AppText>
            <View style={styles.balanceRow}>
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
      </ScrollView>

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
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radii.sm,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  body: { flex: 1 },

  // Section
  section: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xxl },
  sectionLabel: { marginBottom: 10 },

  // Type chips
  typeChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radii.md, backgroundColor: colors.cream,
    borderWidth: 2, borderColor: "transparent",
  },
  typeChipActive: {
    backgroundColor: colors.sagePale,
    borderColor: colors.sage,
  },

  // Icon
  iconSection: { alignItems: "center", paddingVertical: 24 },
  iconPreview: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    ...shadows.md,
  },

  // Form
  formCard: {
    marginHorizontal: spacing.xxl, backgroundColor: colors.cream,
    borderRadius: radii.lg, overflow: "hidden",
  },
  formField: { padding: spacing.xl },
  fieldLabel: { marginBottom: 6, letterSpacing: 0.5 },
  fieldInput: { fontSize: 15, color: colors.text, fontWeight: "500" },
  fieldSep: { height: 1, backgroundColor: colors.creamDark, marginHorizontal: spacing.xl },
  balanceRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  balancePrefix: { fontSize: 20, fontWeight: "700", color: colors.textLighter },
  balanceInput: { flex: 1, fontSize: 28, fontWeight: "700", color: colors.text },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: spacing.xl, paddingTop: 12,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.creamDark,
  },
  saveBtn: {
    height: 48, borderRadius: radii.md, backgroundColor: colors.sage,
    alignItems: "center", justifyContent: "center", ...shadows.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
});

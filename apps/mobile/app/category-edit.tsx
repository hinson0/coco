// 分类添加/编辑页面 — emoji 图标选择，名称输入，类型选择（仅新增时）
import { useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCreateCategory, useUpdateCategory } from "../hooks/useLocalCategories";
import { EmojiPicker } from "../components/shared/EmojiPicker";
import { AppText } from "../components/ui/AppText";
import { colors, radii, spacing } from "../constants/theme";
import type { TransactionType } from "@coco/shared";

export default function CategoryEditScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; name?: string; icon?: string; type?: string }>();
  const isEdit = !!params.id;

  const { mutateAsync: createCategory } = useCreateCategory();
  const { mutateAsync: updateCategory } = useUpdateCategory();

  const [name, setName] = useState(params.name ?? "");
  const [icon, setIcon] = useState(params.icon ?? "📦");
  const [type, setType] = useState<TransactionType>((params.type as TransactionType) ?? "expense");
  const [submitting, setSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("请输入分类名称");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateCategory({ id: params.id!, name: name.trim(), icon });
      } else {
        await createCategory({ name: name.trim(), icon, type });
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">{isEdit ? "编辑分类" : "添加分类"}</AppText>
        <TouchableOpacity onPress={handleSave} disabled={submitting} activeOpacity={0.7}>
          {submitting ? (
            <ActivityIndicator color={colors.sage} size="small" />
          ) : (
            <AppText size="xl" weight="semibold" color={colors.sage}>保存</AppText>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.iconSection}>
        <TouchableOpacity onPress={() => setShowEmojiPicker(true)} activeOpacity={0.8}>
          <View style={styles.iconPreview}>
            <AppText style={{ fontSize: 40 }}>{icon}</AppText>
          </View>
        </TouchableOpacity>
        <AppText size="md" color={colors.sage} style={{ marginTop: 8 }}>点击更换图标</AppText>
      </View>

      <View style={styles.fieldCard}>
        <AppText size="md" color={colors.textLighter} style={{ marginBottom: 6 }}>分类名称</AppText>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="输入分类名称"
          placeholderTextColor={colors.textLighter}
          maxLength={10}
        />
      </View>

      {!isEdit && (
        <View style={styles.typeSection}>
          <AppText size="md" color={colors.textLighter} style={{ marginBottom: 10, marginHorizontal: spacing.xxl }}>类型</AppText>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeBtn, type === "expense" && { backgroundColor: colors.coral }]}
              onPress={() => setType("expense")}
              activeOpacity={0.7}
            >
              <AppText size="xl" weight="semibold" color={type === "expense" ? colors.white : colors.textLight}>支出</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, type === "income" && { backgroundColor: colors.sage }]}
              onPress={() => setType("income")}
              activeOpacity={0.7}
            >
              <AppText size="xl" weight="semibold" color={type === "income" ? colors.white : colors.textLight}>收入</AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <EmojiPicker
        visible={showEmojiPicker}
        onSelect={setIcon}
        onClose={() => setShowEmojiPicker(false)}
      />
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
  iconSection: { alignItems: "center", paddingVertical: 28 },
  iconPreview: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  fieldCard: {
    marginHorizontal: spacing.xxl, backgroundColor: colors.cream,
    borderRadius: radii.md, padding: spacing.xl,
  },
  input: { fontSize: 16, color: colors.text, fontWeight: "500" },
  typeSection: { marginTop: spacing.xxl },
  typeRow: { flexDirection: "row", gap: 12, paddingHorizontal: spacing.xxl },
  typeBtn: {
    flex: 1, paddingVertical: 14, borderRadius: radii.md,
    backgroundColor: colors.cream, alignItems: "center",
  },
});

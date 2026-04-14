import { useState, useEffect } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../ui/AppText";
import { CategoryPicker } from "../CategoryPicker";
import { colors, radii, spacing } from "../../constants/theme";
import { useRecentCategory } from "../../hooks/useRecentCategory";
import type { PendingNotification } from "../../lib/auto-bookkeeping/pending-queue";

interface ConfirmSheetProps {
  readonly visible: boolean;
  readonly pending: PendingNotification | null;
  readonly onConfirm: (categoryId: string, note: string) => void;
  readonly onDismiss: () => void;
}

export function ConfirmSheet({
  visible,
  pending,
  onConfirm,
  onDismiss,
}: ConfirmSheetProps) {
  const insets = useSafeAreaInsets();
  const txType = pending?.type ?? "expense";
  const { data: recentCategoryId } = useRecentCategory(txType);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (visible && recentCategoryId) {
      setCategoryId(recentCategoryId);
    }
    if (visible) {
      setNote("");
    }
  }, [visible, recentCategoryId]);

  const sourceLabel = pending?.source === "wechat" ? "微信支付" : "支付宝";

  const handleConfirm = () => {
    if (!categoryId) return;
    onConfirm(categoryId, note);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouch}
          activeOpacity={1}
          onPress={onDismiss}
        />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 24 },
          ]}
        >
          <View style={styles.header}>
            <AppText size="2xl" weight="semibold">
              检测到一笔{txType === "income" ? "收入" : "消费"}
            </AppText>
            <TouchableOpacity onPress={onDismiss} activeOpacity={0.7}>
              <AppText size="2xl" color={colors.textLighter}>
                ✕
              </AppText>
            </TouchableOpacity>
          </View>

          <View style={styles.amountRow}>
            <AppText size="5xl" weight="bold" color={colors.text}>
              ¥{pending?.amount.toFixed(2) ?? "0.00"}
            </AppText>
            <View style={styles.sourceBadge}>
              <AppText size="sm" color={colors.textLight}>
                {sourceLabel}
              </AppText>
            </View>
          </View>

          <View style={styles.section}>
            <AppText
              size="base"
              color={colors.textLight}
              style={styles.sectionLabel}
            >
              分类
            </AppText>
            <CategoryPicker
              selectedId={categoryId}
              onSelect={setCategoryId}
              type={txType}
            />
          </View>

          <View style={styles.section}>
            <AppText
              size="base"
              color={colors.textLight}
              style={styles.sectionLabel}
            >
              备注
            </AppText>
            <TextInput
              style={styles.noteInput}
              placeholder="选填..."
              placeholderTextColor={colors.textLighter}
              value={note}
              onChangeText={setNote}
              multiline
              returnKeyType="default"
              blurOnSubmit={false}
            />
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.dismissBtn}
              activeOpacity={0.8}
              onPress={onDismiss}
            >
              <AppText size="xl" weight="medium" color={colors.textLight}>
                忽略
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                !categoryId && styles.confirmBtnDisabled,
              ]}
              activeOpacity={0.8}
              onPress={handleConfirm}
              disabled={!categoryId}
            >
              <AppText size="xl" weight="semibold" color={colors.white}>
                确认记账
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  overlayTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: 12,
  },
  sourceBadge: {
    backgroundColor: colors.sagePale,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  section: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    marginBottom: 8,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.creamDark,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    minHeight: 44,
  },
  buttons: {
    flexDirection: "row",
    paddingHorizontal: spacing.xxl,
    gap: 12,
  },
  dismissBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.creamDark,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: colors.sage,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
});

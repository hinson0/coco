import { View, StyleSheet, Pressable, Alert } from "react-native";
import { AppText } from "../ui/AppText";
import { Badge } from "../ui/Badge";
import { colors, radii, spacing } from "../../constants/theme";
import { formatAmount } from "../../lib/format";
import {
  isAiSource,
  isNotificationSource,
  getSourceLabel,
  getNotificationLabel,
} from "../../lib/badge-utils";
import { MAJOR_AMOUNT_THRESHOLD } from "@coco/shared";
import type { Transaction } from "@coco/shared";

interface RecordCardProps {
  readonly transaction: Transaction;
  readonly categoryName?: string;
  readonly categoryIcon?: string;
  readonly onEdit?: () => void;
  readonly onDelete?: () => void;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, "0")}月${String(d.getDate()).padStart(2, "0")}日`;
}

export function RecordCard({
  transaction,
  categoryName,
  categoryIcon,
  onEdit,
  onDelete,
}: RecordCardProps) {
  const isExpense = transaction.type === "expense";
  const amountStr = formatAmount(transaction.amount, transaction.type);
  const isMajor = isExpense && transaction.amount >= MAJOR_AMOUNT_THRESHOLD;
  const sourceLabel = getSourceLabel(transaction.source);

  return (
    <View style={styles.card}>
      {/* Top row: icon + category/note + amount */}
      <View style={styles.topRow}>
        <View style={styles.iconBox}>
          <AppText size="xl">{categoryIcon ?? "📦"}</AppText>
        </View>
        <View style={styles.info}>
          <View style={styles.categoryRow}>
            <AppText size="lg" weight="semibold" color={colors.text}>
              {categoryName ?? "未知"}
            </AppText>
            {isMajor ? <Badge text="大宗" variant="pro" /> : null}
            {isAiSource(transaction.source) ? (
              <Badge text="AI" variant="ai" />
            ) : null}
            {sourceLabel ? <Badge text={sourceLabel} variant="auto" /> : null}
            {isNotificationSource(transaction.source) ? (
              <Badge
                text={getNotificationLabel(transaction.raw_input)}
                variant="auto"
              />
            ) : null}
          </View>
          {transaction.note ? (
            <AppText size="base" color={colors.textLighter}>
              {transaction.note}
            </AppText>
          ) : null}
        </View>
        <AppText
          size="2xl"
          weight="bold"
          color={isExpense ? colors.coral : colors.sage}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {amountStr}
        </AppText>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Bottom row: date + actions */}
      <View style={styles.bottomRow}>
        <AppText size="base" color={colors.textLighter}>
          {formatDate(transaction.occurred_at)}
        </AppText>
        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              Alert.alert("删除记录", "确定要删除这笔记账吗？", [
                { text: "取消", style: "cancel" },
                { text: "删除", style: "destructive", onPress: onDelete },
              ]);
            }}
            style={({ pressed }) => [
              styles.actionBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <AppText size="base">🗑</AppText>
          </Pressable>
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [
              styles.actionBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <AppText size="base" color={colors.textLight}>
              ✏ 编辑
            </AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.creamDark,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },

  // Top: [icon] [category/note] [amount]
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.lg,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.creamDark,
    marginVertical: spacing.lg,
  },

  // Bottom: [date] [trash] [edit]
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  actionBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  btnPressed: {
    opacity: 0.6,
  },
});

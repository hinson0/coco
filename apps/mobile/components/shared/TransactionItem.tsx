import { TouchableOpacity, View, StyleSheet } from "react-native";
import { AppText } from "../ui/AppText";
import { IconBox } from "../ui/IconBox";
import { Badge } from "../ui/Badge";
import {
  colors,
  radii,
  shadows,
  type CategoryColorName,
} from "../../constants/theme";
import { formatAmount } from "../../lib/format";
import { MAJOR_AMOUNT_THRESHOLD } from "@coco/shared";
import type { Transaction } from "@coco/shared";

interface TransactionItemProps {
  readonly transaction: Transaction;
  readonly categoryIcon: string;
  readonly categoryName: string;
  readonly categoryColor: CategoryColorName;
  readonly onPress?: () => void;
  readonly onLongPress?: () => void;
}

export function TransactionItem({
  transaction,
  categoryIcon,
  categoryName,
  categoryColor,
  onPress,
  onLongPress,
}: TransactionItemProps) {
  const isIncome = transaction.type === "income";
  const amountColor = isIncome ? colors.sage : colors.text;
  const occurredDate = new Date(transaction.occurred_at);
  const datePrefix = `${occurredDate.getMonth() + 1}/${occurredDate.getDate()}`;
  const time = `${datePrefix} ${occurredDate.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  const isAi =
    transaction.source === "text" ||
    transaction.source === "asr" ||
    transaction.source === "ocr";
  const isMajor = !isIncome && transaction.amount >= MAJOR_AMOUNT_THRESHOLD;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <IconBox emoji={categoryIcon} colorName={categoryColor} />
      <View style={styles.info}>
        <AppText size="lg" weight="semibold">
          {transaction.note || categoryName}
        </AppText>
        <View style={styles.meta}>
          <AppText size="base" color={colors.textLighter}>
            {time} · {categoryName}
          </AppText>
          {isAi ? <Badge text="AI" variant="ai" /> : null}
          {isMajor ? <Badge text="大宗" variant="pro" /> : null}
        </View>
      </View>
      <AppText size="xl" weight="bold" color={amountColor}>
        {formatAmount(transaction.amount, transaction.type)}
      </AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    marginBottom: 8,
    ...shadows.md,
  },
  info: { flex: 1, minWidth: 0 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
});

import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { IconBox } from '../ui/IconBox';
import { Badge } from '../ui/Badge';
import { colors, radii, shadows, type CategoryColorName } from '../../constants/theme';
import type { Transaction } from '@coco/shared';

interface TransactionItemProps {
  readonly transaction: Transaction;
  readonly categoryIcon: string;
  readonly categoryName: string;
  readonly categoryColor: CategoryColorName;
  readonly onPress?: () => void;
}

export function TransactionItem({ transaction, categoryIcon, categoryName, categoryColor, onPress }: TransactionItemProps) {
  const isIncome = transaction.type === 'income';
  const amountPrefix = isIncome ? '+' : '-';
  const amountColor = isIncome ? colors.sage : colors.text;
  const time = new Date(transaction.occurred_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const isAi = transaction.source === 'text' || transaction.source === 'asr' || transaction.source === 'ocr';

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <IconBox emoji={categoryIcon} colorName={categoryColor} />
      <View style={styles.info}>
        <AppText size="lg" weight="semibold">{transaction.note || categoryName}</AppText>
        <View style={styles.meta}>
          <AppText size="base" color={colors.textLighter}>{time} · {categoryName}</AppText>
          {isAi ? <Badge text="AI" variant="ai" /> : null}
        </View>
      </View>
      <AppText size="xl" weight="bold" color={amountColor}>
        {amountPrefix}¥{Math.abs(transaction.amount).toLocaleString()}
      </AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    marginBottom: 8,
    ...shadows.md,
  },
  info: { flex: 1, minWidth: 0 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
});

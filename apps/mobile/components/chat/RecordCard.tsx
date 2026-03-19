import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, radii, spacing, shadows, getCategoryColor, categoryColors } from '../../constants/theme';
import type { Transaction } from '@coco/shared';

interface RecordCardProps {
  readonly transaction: Transaction;
  readonly categoryName?: string;
  readonly onEdit?: () => void;
  readonly onDelete?: () => void;
  readonly variant?: 'text' | 'ocr';
}

const CATEGORY_EMOJI: Record<string, string> = {
  '餐饮': '🍔', '交通': '🚗', '购物': '🛒', '娱乐': '🎮',
  '居住': '🏠', '医疗': '💊', '教育': '📚', '通讯': '📱',
  '工资': '💰', '理财': '📈', '其他收入': '💵', '其他支出': '📦',
  '咖啡': '☕', '饮品': '🧋',
};

export function RecordCard({ transaction, categoryName, onEdit, onDelete, variant = 'text' }: RecordCardProps) {
  const name = categoryName ?? '未知';
  const colorKey = getCategoryColor(name);
  const palette = categoryColors[colorKey];
  const emoji = CATEGORY_EMOJI[name] ?? '📝';

  return (
    <View style={[styles.card, shadows.md]}>
      {/* Amount hero section */}
      <View style={styles.amountSection}>
        <View style={[styles.categoryBadge, { backgroundColor: palette.bg }]}>
          <AppText size="lg">{emoji}</AppText>
          <AppText size="base" weight="semibold" color={palette.icon}>{name}</AppText>
        </View>
        <AppText size="5xl" weight="bold" color={colors.text} style={styles.amount}>
          ¥ {transaction.amount.toFixed(2)}
        </AppText>
      </View>

      {/* Detail rows */}
      <View style={styles.details}>
        {variant === 'text' && transaction.note ? (
          <DetailRow label="备注" value={transaction.note} />
        ) : null}

        {variant === 'ocr' && (
          <>
            {transaction.raw_input ? <DetailRow label="商户" value={transaction.raw_input} /> : null}
            {transaction.note ? <DetailRow label="明细" value={transaction.note} /> : null}
          </>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.footer}>
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [styles.actionBtn, pressed && styles.btnPressed]}
        >
          <AppText size="base" weight="medium" color={colors.textLight}>修改</AppText>
        </Pressable>
        <View style={styles.btnDivider} />
        <Pressable
          onPress={() => {
            Alert.alert("删除记录", "确定要删除这笔记账吗？", [
              { text: "取消", style: "cancel" },
              { text: "删除", style: "destructive", onPress: onDelete },
            ]);
          }}
          style={({ pressed }) => [styles.actionBtn, pressed && styles.btnPressed]}
        >
          <AppText size="base" weight="medium" color={colors.coral}>删除</AppText>
        </Pressable>
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <AppText size="base" color={colors.textLighter}>{label}</AppText>
      <AppText size="base" color={colors.text}>{value}</AppText>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    overflow: 'hidden',
    minWidth: 220,
  },

  // Amount hero
  amountSection: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    marginBottom: spacing.lg,
  },
  amount: {
    letterSpacing: -0.5,
  },

  // Details
  details: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
  },

  // Footer actions
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.creamDark,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  btnDivider: {
    width: 1,
    backgroundColor: colors.creamDark,
  },
  btnPressed: {
    backgroundColor: colors.cream,
  },
});

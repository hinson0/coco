import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, radii, spacing } from '../../constants/theme';
import type { Transaction } from '@coco/shared';

interface RecordCardProps {
  readonly transaction: Transaction;
  readonly categoryName?: string;
  readonly onEdit?: () => void;
  readonly onDelete?: () => void;
  readonly variant?: 'text' | 'ocr';
}

export function RecordCard({ transaction, categoryName, onEdit, onDelete, variant = 'text' }: RecordCardProps) {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <AppText size="lg">✅</AppText>
          <AppText size="lg" weight="semibold" color={colors.text} style={styles.headerTitle}>
            已记账
          </AppText>
        </View>
        <View style={styles.doneBadge}>
          <AppText size="xs" weight="medium" color={colors.sage}>已记录</AppText>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Rows */}
      <View style={styles.rows}>
        <Row label="金额">
          <AppText size="2xl" weight="bold" color={colors.coral}>
            ¥ {transaction.amount.toFixed(2)}
          </AppText>
        </Row>

        <Row label="分类">
          <AppText size="xl" color={colors.text}>{categoryName ?? '未知'}</AppText>
        </Row>

        {variant === 'text' && (
          <Row label="备注">
            <AppText size="xl" color={colors.text}>{transaction.note || '无'}</AppText>
          </Row>
        )}

        {variant === 'ocr' && (
          <>
            <Row label="商户">
              <AppText size="xl" color={colors.text}>{transaction.raw_input || '未知'}</AppText>
            </Row>
            <Row label="明细">
              <AppText size="xl" color={colors.text}>{transaction.note || '无'}</AppText>
            </Row>
          </>
        )}
      </View>

      {/* Footer buttons */}
      <View style={styles.footer}>
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [styles.editBtn, pressed && styles.btnPressed]}
        >
          <AppText size="lg" weight="medium" color={colors.textLight}>修改</AppText>
        </Pressable>
        <Pressable
          onPress={() => {
            Alert.alert("删除记录", "确定要删除这笔记账吗？", [
              { text: "取消", style: "cancel" },
              { text: "删除", style: "destructive", onPress: onDelete },
            ]);
          }}
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.btnPressed]}
        >
          <AppText size="lg" weight="medium" color="#E74C3C">删除</AppText>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={rowStyles.row}>
      <AppText size="xl" color={colors.textLighter} style={rowStyles.label}>{label}</AppText>
      {children}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  label: {
    flex: 1,
  },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cream,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.creamDark,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    marginLeft: spacing.sm,
  },
  doneBadge: {
    backgroundColor: colors.sagePale,
    borderRadius: radii.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.creamDark,
    marginHorizontal: spacing.xl,
  },
  rows: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  editBtn: {
    flex: 1,
    backgroundColor: colors.creamDark,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: colors.creamDark,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  btnPressed: {
    opacity: 0.8,
  },
});

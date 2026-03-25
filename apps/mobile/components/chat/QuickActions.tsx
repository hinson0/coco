import { ScrollView, Pressable, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, spacing } from '../../constants/theme';

interface QuickAction {
  readonly icon: string;
  readonly label: string;
  readonly text: string;
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  { icon: '📅', label: '本周报告', text: '本周报告' },
  { icon: '📈', label: '月度趋势', text: '本月趋势' },
  { icon: '💰', label: '今日花费', text: '今天花了多少' },
  { icon: '🏷️', label: '分类统计', text: '各分类支出统计' },
];

interface QuickActionsProps {
  readonly visible: boolean;
  readonly onSelect: (text: string) => void;
}

export function QuickActions({ visible, onSelect }: QuickActionsProps) {
  if (!visible) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {QUICK_ACTIONS.map((action) => (
        <Pressable
          key={action.label}
          onPress={() => onSelect(action.text)}
          style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
        >
          <AppText size="md">{action.icon}</AppText>
          <AppText size="md" color={colors.text}>{action.label}</AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.creamDark,
    borderRadius: 20,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  itemPressed: {
    opacity: 0.75,
  },
});

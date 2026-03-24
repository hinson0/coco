import { View, Pressable, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, shadows } from '../../constants/theme';

interface AccountSelectorBarProps {
  readonly monthLabel: string;  // e.g. "2026年03月"
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

export function AccountSelectorBar({ monthLabel, onPrev, onNext }: AccountSelectorBarProps) {
  return (
    <View style={styles.container}>
      <Pressable style={styles.accountBtn}>
        <AppText size="md" weight="semibold" color={colors.text}>我的账本</AppText>
        <AppText size="sm" color={colors.textLight}> ▼</AppText>
      </Pressable>

      <View style={styles.monthNav}>
        <Pressable onPress={onPrev} style={styles.arrow}>
          <AppText size="xl" weight="bold" color={colors.text}>‹</AppText>
        </Pressable>
        <AppText size="md" weight="semibold" color={colors.text}>{monthLabel}</AppText>
        <Pressable onPress={onNext} style={styles.arrow}>
          <AppText size="xl" weight="bold" color={colors.text}>›</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  accountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    ...shadows.sm,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrow: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

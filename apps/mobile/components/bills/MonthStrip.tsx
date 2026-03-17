import { View, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, radii, shadows } from '../../constants/theme';

interface MonthStripProps {
  readonly month: string;
  readonly count: number;
  readonly total: string;
}

export function MonthStrip({ month, count, total }: MonthStripProps) {
  return (
    <View style={styles.card}>
      {/* Left: month label + count badge */}
      <View style={styles.left}>
        <AppText size="xl" weight="bold" color={colors.text}>
          {month}
        </AppText>
        <View style={styles.badge}>
          <AppText size="sm" weight="semibold" color={colors.textLight}>
            {count}笔
          </AppText>
        </View>
      </View>

      {/* Right: total amount */}
      <AppText size="2xl" weight="bold" color={colors.coral}>
        {total}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    ...shadows.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: colors.creamDark,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
});

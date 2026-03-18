import { View, Pressable, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, shadows } from '../../constants/theme';

type Period = 'week' | 'month' | 'year';

const LABELS: Record<Period, string> = { week: '周', month: '月', year: '年' };

interface PeriodTabsProps {
  readonly active: Period;
  readonly onChange: (period: Period) => void;
}

export function PeriodTabs({ active, onChange }: PeriodTabsProps) {
  return (
    <View style={styles.container}>
      {(['week', 'month', 'year'] as const).map((period) => (
        <Pressable
          key={period}
          style={[styles.tab, active === period && styles.tabActive]}
          onPress={() => onChange(period)}
        >
          <AppText
            size="lg"
            weight="semibold"
            color={active === period ? colors.white : colors.textLighter}
          >
            {LABELS[period]}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 3,
    ...shadows.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.sage,
  },
});

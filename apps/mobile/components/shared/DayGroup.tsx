import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';

interface DayGroupProps {
  readonly label: string;
  readonly date: string;
  readonly total: string;
  readonly totalColor?: string;
  readonly children: ReactNode;
}

export function DayGroup({ label, date, total, totalColor = colors.coral, children }: DayGroupProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <AppText size="lg" weight="bold">{label}</AppText>
          <AppText size="base" color={colors.textLighter}>{date}</AppText>
        </View>
        <AppText size="md" weight="semibold" color={totalColor}>{total}</AppText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
});

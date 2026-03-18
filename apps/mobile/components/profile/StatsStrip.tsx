import { View, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';

interface StatItem {
  readonly value: string;
  readonly label: string;
}

interface StatsStripProps {
  readonly items: StatItem[];
}

export function StatsStrip({ items }: StatsStripProps) {
  return (
    <Card padding={0} style={styles.card}>
      <View style={styles.row}>
        {items.map((item, index) => (
          <View key={index} style={styles.itemWrapper}>
            {index > 0 && <View style={styles.divider} />}
            <View style={styles.item}>
              <AppText size="4xl" weight="bold" style={styles.value}>{item.value}</AppText>
              <AppText size="sm" color={colors.textLighter} style={styles.label}>{item.label}</AppText>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 16,
  },
  itemWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: '70%',
    backgroundColor: colors.creamDark,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  value: {
    textAlign: 'center',
  },
  label: {
    textAlign: 'center',
  },
});

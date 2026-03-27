import { View, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';

interface InsightBadge {
  readonly text: string;
  readonly direction: 'up' | 'down';
}

interface InsightItem {
  readonly emoji: string;
  readonly title: string;
  readonly desc: string;
  readonly badge?: InsightBadge;
}

interface TrendInsightRowProps {
  readonly items: InsightItem[];
}

function Badge({ badge }: { badge: InsightBadge }) {
  const isUp = badge.direction === 'up';
  return (
    <View style={[styles.badge, isUp ? styles.badgeUp : styles.badgeDown]}>
      <AppText
        size="base"
        weight="semibold"
        color={isUp ? colors.coral : colors.sage}
      >
        {badge.text}
      </AppText>
    </View>
  );
}

export function TrendInsightRow({ items }: TrendInsightRowProps) {
  return (
    <Card radius="lg" shadow="md" padding={16}>
      <View style={styles.titleRow}>
        <View style={styles.titleAccent} />
        <AppText size="lg" weight="semibold" color={colors.text}>
          AI 洞察
        </AppText>
      </View>
      {items.map((item, index) => (
        <View key={item.title}>
          {index > 0 && <View style={styles.divider} />}
          <View style={styles.row}>
            <AppText size="xl" style={styles.emoji}>{item.emoji}</AppText>
            <View style={styles.info}>
              <AppText size="lg" weight="semibold" color={colors.text}>{item.title}</AppText>
              <AppText size="base" color={colors.textLighter}>{item.desc}</AppText>
            </View>
            {item.badge ? <Badge badge={item.badge} /> : null}
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  titleAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.honey,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  emoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.creamDark,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  badgeUp: {
    backgroundColor: colors.coralPale,
  },
  badgeDown: {
    backgroundColor: colors.sagePale,
  },
});

// apps/mobile/components/stats/HealthScoreCard.tsx
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';
import type { InsightItem } from '../../utils/insights/types';

interface HealthScoreCardProps {
  readonly item: InsightItem;
}

const RADIUS = 33;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function scoreColor(score: number): string {
  if (score > 80) return colors.sage;
  if (score > 60) return colors.sage;
  if (score > 40) return colors.honey;
  return colors.coral;
}

export function HealthScoreCard({ item }: HealthScoreCardProps) {
  const score = (item.meta?.score as number) ?? 0;
  const level = (item.meta?.level as string) ?? '';
  const strokeDashoffset = CIRCUMFERENCE * (1 - score / 100);
  const color = scoreColor(score);

  return (
    <Card radius="lg" shadow="md" padding={16}>
      <View style={styles.row}>
        <View style={styles.ringWrap}>
          <Svg width={80} height={80} viewBox="0 0 80 80" style={styles.svg}>
            <Circle cx={40} cy={40} r={RADIUS} fill="none" stroke={colors.creamDark} strokeWidth={6} />
            <Circle
              cx={40} cy={40} r={RADIUS}
              fill="none" stroke={color} strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE}`}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 40 40)"
            />
          </Svg>
          <View style={styles.scoreCenter}>
            <AppText size="5xl" weight="bold" color={color}>{score}</AppText>
            <AppText size="xs" color={colors.textLighter}>健康分</AppText>
          </View>
        </View>
        <View style={styles.info}>
          <AppText size="lg" weight="semibold" color={colors.text}>
            收支健康度 · {level}
          </AppText>
          <AppText size="base" color={colors.textLight} style={styles.desc}>
            {item.desc}
          </AppText>
          {item.badge ? (
            <View style={[styles.badge, item.badge.direction === 'up' ? styles.badgeDown : styles.badgeUp]}>
              <AppText size="sm" weight="semibold" color={item.badge.direction === 'up' ? colors.coral : colors.sage}>
                {item.badge.text}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ringWrap: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    position: 'absolute',
  },
  scoreCenter: {
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  desc: {
    lineHeight: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 2,
  },
  badgeUp: {
    backgroundColor: colors.sagePale,
  },
  badgeDown: {
    backgroundColor: colors.coralPale,
  },
});

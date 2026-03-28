import { View, Pressable, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, shadows } from '../../constants/theme';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

interface AccountSelectorBarProps {
  readonly monthLabel: string;  // e.g. "2026年03月"
  readonly currentDate: Date;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

function formatDateLabel(date: Date): string {
  const today = new Date();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const weekday = WEEKDAYS[date.getDay()];

  const isToday = date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth();

  let label = `${m}月${String(d).padStart(2, '0')}日 ${weekday}`;
  if (isToday) label += '  今天';
  return label;
}

export function AccountSelectorBar({ monthLabel, currentDate, onPrev, onNext }: AccountSelectorBarProps) {
  return (
    <View style={styles.container}>
      {/* 第一行：账本 + 月份导航 */}
      <View style={styles.topRow}>
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

      {/* 第二行：日期信息 */}
      <View style={styles.dateRow}>
        <AppText size="base" color={colors.textLighter}>📅</AppText>
        <AppText size="base" weight="medium" color={colors.textLight}>
          {formatDateLabel(currentDate)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

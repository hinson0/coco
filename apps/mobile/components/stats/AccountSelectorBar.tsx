import { useState } from 'react';
import { View, Pressable, Modal, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, shadows, radii } from '../../constants/theme';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'] as const;

interface AccountSelectorBarProps {
  readonly currentDate: Date;
  readonly onDateChange: (date: Date) => void;
}

function isCurrentMonth(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function formatDateLabel(date: Date): string {
  const m = date.getMonth() + 1;
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const day = isCurrentMonth(date) ? new Date().getDate() : lastDay;
  const weekday = WEEKDAYS[new Date(date.getFullYear(), date.getMonth(), day).getDay()];
  return `${m}月${day}日  ${weekday}`;
}

function CalendarIcon({ day }: { day: number }) {
  return (
    <View style={styles.calendarIcon}>
      <View style={styles.calendarTop}>
        <View style={styles.calendarDot} />
        <View style={styles.calendarDot} />
      </View>
      <AppText size="base" weight="bold" color={colors.text}>{day}</AppText>
    </View>
  );
}

function MonthPicker({
  visible,
  selectedYear,
  selectedMonth,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedYear: number;
  selectedMonth: number;
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
}) {
  const [pickerYear, setPickerYear] = useState(selectedYear);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.pickerCard} onPress={e => e.stopPropagation()}>
          {/* 年份导航 */}
          <View style={styles.yearRow}>
            <Pressable onPress={() => setPickerYear(y => y - 1)} style={styles.yearArrow}>
              <AppText size="2xl" weight="bold" color={colors.text}>‹</AppText>
            </Pressable>
            <AppText size="2xl" weight="bold" color={colors.text}>{pickerYear}年</AppText>
            <Pressable onPress={() => setPickerYear(y => y + 1)} style={styles.yearArrow}>
              <AppText size="2xl" weight="bold" color={colors.text}>›</AppText>
            </Pressable>
          </View>

          {/* 月份网格 */}
          <View style={styles.monthGrid}>
            {MONTHS.map((label, i) => {
              const isSelected = pickerYear === selectedYear && i === selectedMonth;
              const isCurrent = pickerYear === currentYear && i === currentMonth;
              return (
                <Pressable
                  key={i}
                  style={[styles.monthCell, isSelected && styles.monthCellSelected]}
                  onPress={() => { onSelect(pickerYear, i); onClose(); }}
                >
                  <AppText
                    size="lg"
                    weight={isSelected ? 'bold' : 'regular'}
                    color={isSelected ? colors.white : isCurrent ? colors.coral : colors.text}
                  >
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function AccountSelectorBar({ currentDate, onDateChange }: AccountSelectorBarProps) {
  const [pickerVisible, setPickerVisible] = useState(false);

  const isCurrent = isCurrentMonth(currentDate);
  const day = isCurrent ? new Date().getDate() : new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

  return (
    <View style={styles.container}>
      <Pressable style={styles.accountBtn}>
        <AppText size="xl" weight="semibold" color={colors.text}>我的账本</AppText>
        <AppText size="base" color={colors.textLight}> ▼</AppText>
      </Pressable>

      <Pressable style={styles.dateBtn} onPress={() => setPickerVisible(true)}>
        <CalendarIcon day={day} />
        <AppText size="lg" weight="semibold" color={colors.text}>{formatDateLabel(currentDate)}</AppText>
        {isCurrent ? (
          <View style={styles.todayBadge}>
            <AppText size="sm" weight="semibold" color={colors.sage}>今天</AppText>
          </View>
        ) : null}
      </Pressable>

      <MonthPicker
        visible={pickerVisible}
        selectedYear={currentDate.getFullYear()}
        selectedMonth={currentDate.getMonth()}
        onSelect={(year, month) => onDateChange(new Date(year, month, 1))}
        onClose={() => setPickerVisible(false)}
      />
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
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Calendar icon
  calendarIcon: {
    width: 28,
    height: 28,
    backgroundColor: colors.white,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
    borderWidth: 1,
    borderColor: colors.creamDark,
  },
  calendarTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: colors.coral,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  calendarDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.white,
  },
  todayBadge: {
    backgroundColor: colors.sagePale,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  // Month picker modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    width: 300,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 20,
    ...shadows.xl,
  },
  yearRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  yearArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthCell: {
    width: '30%' as any,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  monthCellSelected: {
    backgroundColor: colors.coral,
  },
});

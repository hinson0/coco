import { useState } from "react";
import {
  View,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Image,
  type ImageSourcePropType,
} from "react-native";
import { router } from "expo-router";
import { AppText } from "../ui/AppText";
import { colors, shadows, radii } from "../../constants/theme";
import type { Account } from "@coco/shared";

const BRAND_ICON_MAP: Record<string, ImageSourcePropType> = {
  wechat: require("../../assets/images/wechat.png"),
  alipay: require("../../assets/images/alipay.png"),
};

const MONTHS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
] as const;

interface AccountSelectorBarProps {
  readonly currentDate: Date;
  readonly onDateChange: (date: Date) => void;
  readonly accounts: readonly Account[];
  readonly selectedAccountId: string | null;
  readonly onAccountChange: (accountId: string | null) => void;
}

function isCurrentMonth(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function formatDateLabel(date: Date): string {
  const m = date.getMonth() + 1;
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  const day = isCurrentMonth(date) ? new Date().getDate() : lastDay;
  return `${m}月${day}日`;
}

function CalendarIcon({ day }: { day: number }) {
  return (
    <View style={styles.calendarIcon}>
      <View style={styles.calendarTop}>
        <View style={styles.calendarDot} />
        <View style={styles.calendarDot} />
      </View>
      <AppText size="base" weight="bold" color={colors.text}>
        {day}
      </AppText>
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.pickerCard}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.yearRow}>
            <Pressable
              onPress={() => setPickerYear((y) => y - 1)}
              style={styles.yearArrow}
            >
              <AppText size="2xl" weight="bold" color={colors.text}>
                ‹
              </AppText>
            </Pressable>
            <AppText size="2xl" weight="bold" color={colors.text}>
              {pickerYear}年
            </AppText>
            <Pressable
              onPress={() => setPickerYear((y) => y + 1)}
              style={styles.yearArrow}
            >
              <AppText size="2xl" weight="bold" color={colors.text}>
                ›
              </AppText>
            </Pressable>
          </View>
          <View style={styles.monthGrid}>
            {MONTHS.map((label, i) => {
              const isSelected =
                pickerYear === selectedYear && i === selectedMonth;
              const isCurrent =
                pickerYear === currentYear && i === currentMonth;
              return (
                <Pressable
                  key={i}
                  style={[
                    styles.monthCell,
                    isSelected && styles.monthCellSelected,
                  ]}
                  onPress={() => {
                    onSelect(pickerYear, i);
                    onClose();
                  }}
                >
                  <AppText
                    size="lg"
                    weight={isSelected ? "bold" : "regular"}
                    color={
                      isSelected
                        ? colors.white
                        : isCurrent
                          ? colors.coral
                          : colors.text
                    }
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

function AccountFilterSheet({
  visible,
  accounts,
  selectedAccountId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  accounts: readonly Account[];
  selectedAccountId: string | null;
  onSelect: (accountId: string | null) => void;
  onClose: () => void;
}) {
  const handleSelect = (id: string | null) => {
    onSelect(id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable
          style={styles.sheetCard}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.sheetHandle} />
          <AppText
            size="xl"
            weight="semibold"
            color={colors.text}
            style={styles.sheetTitle}
          >
            选择账户
          </AppText>

          <ScrollView style={styles.sheetList} bounces={false}>
            {/* 全部账户 */}
            <Pressable
              style={[
                styles.sheetItem,
                selectedAccountId === null && styles.sheetItemSelected,
              ]}
              onPress={() => handleSelect(null)}
            >
              <View style={styles.sheetItemIcon}>
                <AppText size="2xl">📊</AppText>
              </View>
              <View style={styles.sheetItemInfo}>
                <AppText size="lg" weight="semibold" color={colors.text}>
                  全部账户
                </AppText>
                <AppText size="base" color={colors.textLighter}>
                  查看所有账户的汇总数据
                </AppText>
              </View>
              {selectedAccountId === null ? (
                <AppText size="lg" color={colors.sage}>
                  ✓
                </AppText>
              ) : null}
            </Pressable>

            {accounts.map((account) => (
              <Pressable
                key={account.id}
                style={[
                  styles.sheetItem,
                  selectedAccountId === account.id && styles.sheetItemSelected,
                ]}
                onPress={() => handleSelect(account.id)}
              >
                <View style={styles.sheetItemIcon}>
                  {BRAND_ICON_MAP[account.icon] ? (
                    <Image
                      source={BRAND_ICON_MAP[account.icon]}
                      style={{ width: 24, height: 24 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <AppText size="2xl">{account.icon}</AppText>
                  )}
                </View>
                <View style={styles.sheetItemInfo}>
                  <AppText size="lg" weight="semibold" color={colors.text}>
                    {account.name}
                  </AppText>
                </View>
                {selectedAccountId === account.id ? (
                  <AppText size="lg" color={colors.sage}>
                    ✓
                  </AppText>
                ) : null}
              </Pressable>
            ))}

            {/* 新建账户入口 */}
            <Pressable
              style={styles.sheetAddBtn}
              onPress={() => {
                onClose();
                router.push("/accounts");
              }}
            >
              <AppText size="lg" weight="semibold" color={colors.sage}>
                + 管理账户
              </AppText>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function AccountSelectorBar({
  currentDate,
  onDateChange,
  accounts,
  selectedAccountId,
  onAccountChange,
}: AccountSelectorBarProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  const day = isCurrentMonth(currentDate)
    ? new Date().getDate()
    : new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
      ).getDate();

  const selectedAccount = selectedAccountId
    ? accounts.find((a) => a.id === selectedAccountId)
    : null;
  const accountLabel = selectedAccount
    ? BRAND_ICON_MAP[selectedAccount.icon]
      ? selectedAccount.name
      : `${selectedAccount.icon} ${selectedAccount.name}`
    : "全部账户";

  const handlePrev = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    onDateChange(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    onDateChange(d);
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.accountBtn}
        onPress={() => setSheetVisible(true)}
      >
        <AppText size="xl" weight="semibold" color={colors.text}>
          {accountLabel}
        </AppText>
        <AppText size="base" color={colors.textLight}>
          {" "}
          ▼
        </AppText>
      </Pressable>

      <View style={styles.dateRow}>
        <Pressable onPress={handlePrev} style={styles.arrow}>
          <AppText size="3xl" weight="bold" color={colors.textLight}>
            ‹
          </AppText>
        </Pressable>
        <Pressable
          style={styles.dateBtn}
          onPress={() => setPickerVisible(true)}
        >
          <CalendarIcon day={day} />
          <AppText size="lg" weight="semibold" color={colors.text}>
            {formatDateLabel(currentDate)}
          </AppText>
        </Pressable>
        <Pressable onPress={handleNext} style={styles.arrow}>
          <AppText size="3xl" weight="bold" color={colors.textLight}>
            ›
          </AppText>
        </Pressable>
      </View>

      <MonthPicker
        visible={pickerVisible}
        selectedYear={currentDate.getFullYear()}
        selectedMonth={currentDate.getMonth()}
        onSelect={(year, month) => onDateChange(new Date(year, month, 1))}
        onClose={() => setPickerVisible(false)}
      />

      <AccountFilterSheet
        visible={sheetVisible}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelect={onAccountChange}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  accountBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    ...shadows.sm,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  arrow: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  // Calendar icon
  calendarIcon: {
    width: 28,
    height: 28,
    backgroundColor: colors.white,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 2,
    borderWidth: 1,
    borderColor: colors.creamDark,
  },
  calendarTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: colors.coral,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  calendarDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.white,
  },
  // Month picker modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerCard: {
    width: 300,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 20,
    ...shadows.xl,
  },
  yearRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  yearArrow: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  monthCell: {
    width: "30%",
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radii.sm,
  },
  monthCellSelected: {
    backgroundColor: colors.coral,
  },
  // Account filter bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingBottom: 34,
    maxHeight: "60%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.creamDark,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 12,
  },
  sheetTitle: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sheetList: {
    paddingHorizontal: 12,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
  },
  sheetItemSelected: {
    backgroundColor: colors.cream,
  },
  sheetItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetItemInfo: {
    flex: 1,
    gap: 2,
  },
  sheetAddBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
    marginHorizontal: 8,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.sagePale,
    borderStyle: "dashed",
  },
});

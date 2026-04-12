import { View, StyleSheet } from "react-native";
import { Card } from "../ui/Card";
import { AppText } from "../ui/AppText";
import { colors } from "../../constants/theme";

interface SummaryOverviewCardProps {
  readonly totalExpense: number;
  readonly totalIncome: number;
  readonly balance: number;
  readonly avgExpense: number;
  readonly avgIncome: number;
  readonly avgBalance: number;
  readonly dateRangeLabel: string;
}

function balanceColor(value: number): string {
  return value >= 0 ? colors.sage : colors.coral;
}

function fmt(value: number): string {
  return `¥${Math.abs(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function fmtSigned(value: number): string {
  return value < 0
    ? `-¥${Math.abs(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`
    : fmt(value);
}

export function SummaryOverviewCard({
  totalExpense,
  totalIncome,
  balance,
  avgExpense,
  avgIncome,
  avgBalance,
  dateRangeLabel,
}: SummaryOverviewCardProps) {
  return (
    <Card radius="lg" shadow="md" padding={16}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <View style={styles.titleAccent} />
        <AppText size="xl" weight="semibold" color={colors.text}>
          收支总览
        </AppText>
      </View>

      <View style={styles.divider} />

      {/* Total row */}
      <View style={styles.row}>
        <View style={styles.col}>
          <AppText size="sm" color={colors.textLighter}>
            支出
          </AppText>
          <AppText size="2xl" weight="bold" color={colors.coral}>
            {fmt(totalExpense)}
          </AppText>
        </View>
        <View style={styles.col}>
          <AppText size="sm" color={colors.textLighter}>
            收入
          </AppText>
          <AppText size="2xl" weight="bold" color={colors.sage}>
            {fmt(totalIncome)}
          </AppText>
        </View>
        <View style={styles.col}>
          <AppText size="sm" color={colors.textLighter}>
            结余
          </AppText>
          <AppText size="2xl" weight="bold" color={balanceColor(balance)}>
            {fmtSigned(balance)}
          </AppText>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Daily average row */}
      <View style={styles.row}>
        <View style={styles.col}>
          <AppText size="sm" color={colors.textLighter}>
            日均支出
          </AppText>
          <AppText size="lg" weight="semibold" color={colors.textLight}>
            {fmt(avgExpense)}
          </AppText>
        </View>
        <View style={styles.col}>
          <AppText size="sm" color={colors.textLighter}>
            日均收入
          </AppText>
          <AppText size="lg" weight="semibold" color={colors.textLight}>
            {fmt(avgIncome)}
          </AppText>
        </View>
        <View style={styles.col}>
          <AppText size="sm" color={colors.textLighter}>
            日均结余
          </AppText>
          <AppText size="lg" weight="semibold" color={balanceColor(avgBalance)}>
            {fmtSigned(avgBalance)}
          </AppText>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Date range */}
      <View style={styles.dateRow}>
        <AppText size="sm" color={colors.textLighter}>
          月起始日: {dateRangeLabel} ⓘ
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  titleAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.honey,
  },
  divider: { height: 1, backgroundColor: colors.creamDark, marginVertical: 10 },
  row: { flexDirection: "row" },
  col: { flex: 1, alignItems: "center", gap: 4 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});

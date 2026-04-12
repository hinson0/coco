import { View, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from "react-native-reanimated";
import { useEffect } from "react";
import { AppText } from "../ui/AppText";
import { Card } from "../ui/Card";
import { colors } from "../../constants/theme";

interface OverviewSubs {
  readonly expense?: string;
  readonly income?: string;
  readonly balance?: string;
  readonly budget?: string;
  readonly remaining?: string;
  readonly dailyAvg?: string;
}

interface OverviewCardProps {
  readonly expense: string;
  readonly income: string;
  readonly balance: string;
  readonly balanceRaw: number;
  readonly budget: string;
  readonly remaining: string;
  readonly dailyAvg: string;
  readonly budgetPercent: number;
  readonly daysLeft: number;
  readonly hasBudget: boolean;
  readonly onPressBudget?: () => void;
  readonly subs?: OverviewSubs;
}

function Cell({
  label,
  value,
  valueColor,
  sub,
  onPress,
}: {
  label: string;
  value: string;
  valueColor: string;
  sub?: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.cell}>
      <AppText size="sm" weight="medium" color={colors.textLighter}>
        {label}
      </AppText>
      <AppText size="2xl" weight="bold" color={valueColor}>
        {value}
      </AppText>
      {sub ? (
        <AppText size="xs" color={colors.textLighter}>
          {sub}
        </AppText>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.cell}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <AppText size="sm" weight="medium" color={colors.textLighter}>
          {label}
        </AppText>
        <AppText size="2xl" weight="bold" color={valueColor}>
          {value}
        </AppText>
        {sub ? (
          <AppText size="xs" color={colors.textLighter}>
            {sub}
          </AppText>
        ) : null}
      </TouchableOpacity>
    );
  }

  return content;
}

export function OverviewCard({
  expense,
  income,
  balance,
  balanceRaw,
  budget,
  remaining,
  dailyAvg,
  budgetPercent,
  daysLeft,
  hasBudget,
  onPressBudget,
  subs,
}: OverviewCardProps) {
  const barWidth = useSharedValue(0);
  useEffect(() => {
    barWidth.value = withTiming(budgetPercent, { duration: 1000 });
  }, [budgetPercent]);
  const barStyle = useAnimatedStyle(() => ({ width: `${barWidth.value}%` }));

  const balanceColor = balanceRaw < 0 ? colors.coral : colors.sage;
  const budgetValueColor = hasBudget ? colors.honey : colors.textLighter;

  return (
    <Card radius="xl" shadow="lg" padding={18}>
      <View style={styles.grid}>
        <Cell
          label="支出"
          value={expense}
          valueColor={colors.coral}
          sub={subs?.expense}
        />
        <Cell
          label="收入"
          value={income}
          valueColor={colors.sage}
          sub={subs?.income}
        />
        <Cell
          label="结余"
          value={balance}
          valueColor={balanceColor}
          sub={subs?.balance}
        />
      </View>
      <View style={styles.divider} />
      <View style={styles.grid}>
        <Cell
          label="本月预算"
          value={budget}
          valueColor={budgetValueColor}
          sub={subs?.budget}
          onPress={onPressBudget}
        />
        <Cell
          label="月剩余"
          value={remaining}
          valueColor={hasBudget ? colors.sage : colors.textLighter}
          sub={subs?.remaining}
        />
        <Cell
          label="剩余日均"
          value={dailyAvg}
          valueColor={hasBudget ? colors.lavender : colors.textLighter}
          sub={`还剩${daysLeft}天`}
        />
      </View>
      {hasBudget && (
        <View style={styles.barContainer}>
          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFillWrapper, barStyle]}>
              <LinearGradient
                colors={["#e8c87a", "#f4b0a0"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.barFill}
              />
            </Animated.View>
          </View>
          <View style={styles.barLabels}>
            <AppText size="xs" color={colors.textLighter}>
              已用 {budgetPercent}%
            </AppText>
            <AppText size="xs" color={colors.textLighter}>
              {expense} / {budget}
            </AppText>
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row" },
  cell: { flex: 1, alignItems: "center", paddingVertical: 8 },
  divider: {
    height: 1,
    backgroundColor: colors.creamDark,
    marginHorizontal: 10,
    marginVertical: 2,
  },
  barContainer: { paddingTop: 4, paddingHorizontal: 6 },
  barTrack: {
    height: 6,
    backgroundColor: colors.creamDark,
    borderRadius: 6,
    overflow: "hidden",
  },
  barFillWrapper: { height: "100%" },
  barFill: { flex: 1, borderRadius: 6 },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
});

// apps/mobile/components/stats/InsightCard.tsx
import { View, Pressable, StyleSheet } from "react-native";
import { router, type Href } from "expo-router";
import { Card } from "../ui/Card";
import { AppText } from "../ui/AppText";
import { colors } from "../../constants/theme";
import type {
  InsightItem,
  CategoryChangeMeta,
  AnomalyMeta,
  PaceMeta,
  FrequencyMeta,
  SavingMeta,
} from "../../utils/insights/types";

interface InsightCardProps {
  readonly item: InsightItem;
}

const ACCENT_COLORS: Record<
  string,
  { bar: string; emojiBg: string; badgeBg: string; badgeText: string }
> = {
  "category-change-up": {
    bar: colors.coral,
    emojiBg: colors.coralPale,
    badgeBg: colors.coralPale,
    badgeText: colors.coral,
  },
  "category-change-down": {
    bar: colors.sage,
    emojiBg: colors.sagePale,
    badgeBg: colors.sagePale,
    badgeText: colors.sage,
  },
  anomaly: {
    bar: colors.lavender,
    emojiBg: colors.lavenderPale,
    badgeBg: colors.lavenderPale,
    badgeText: colors.lavender,
  },
  pace: {
    bar: colors.coral,
    emojiBg: colors.coralPale,
    badgeBg: colors.honeyPale,
    badgeText: colors.honey,
  },
  frequency: {
    bar: colors.lavender,
    emojiBg: colors.lavenderPale,
    badgeBg: colors.lavenderPale,
    badgeText: colors.lavender,
  },
  saving: {
    bar: colors.honey,
    emojiBg: colors.honeyPale,
    badgeBg: colors.honeyPale,
    badgeText: colors.honey,
  },
};

function getAccent(item: InsightItem) {
  if (item.type === "category-change") {
    return item.badge?.direction === "down"
      ? ACCENT_COLORS["category-change-down"]
      : ACCENT_COLORS["category-change-up"];
  }
  return ACCENT_COLORS[item.type] ?? ACCENT_COLORS["saving"];
}

function CompareRow({ meta }: { meta: CategoryChangeMeta }) {
  return (
    <View style={styles.compareRow}>
      <View style={styles.compareItem}>
        <AppText size="sm" color={colors.textLighter}>
          本月
        </AppText>
        <AppText size="lg" weight="bold" color={colors.coral}>
          ¥{Math.round(meta.currentAmount).toLocaleString()}
        </AppText>
      </View>
      <View style={styles.compareItem}>
        <AppText size="sm" color={colors.textLighter}>
          上月
        </AppText>
        <AppText size="lg" weight="bold" color={colors.text}>
          ¥{Math.round(meta.previousAmount).toLocaleString()}
        </AppText>
      </View>
    </View>
  );
}

function AnomalyDetail({ meta }: { meta: AnomalyMeta }) {
  const dateStr = meta.date;
  const d = new Date(dateStr);
  const formatted = `${d.getMonth() + 1}月${d.getDate()}日`;
  return (
    <View style={styles.anomalyDetail}>
      <AppText size="4xl" weight="bold" color={colors.lavender}>
        ¥{Math.round(meta.amount).toLocaleString()}
      </AppText>
      <View style={styles.anomalyMeta}>
        <AppText size="base" weight="semibold" color={colors.text}>
          {meta.categoryEmoji} {meta.categoryName}
        </AppText>
        <AppText size="sm" color={colors.textLighter}>
          {formatted}
        </AppText>
      </View>
    </View>
  );
}

function PaceBar({ meta }: { meta: PaceMeta }) {
  const spendPct = Math.round(meta.spendProgress * 100);
  return (
    <View style={styles.paceWrap}>
      <View style={styles.paceTrack}>
        <View
          style={[styles.paceFill, { width: `${Math.min(100, spendPct)}%` }]}
        />
      </View>
      <View style={styles.paceLabels}>
        <AppText size="xs" color={colors.textLighter}>
          月初
        </AppText>
        <AppText size="xs" weight="semibold" color={colors.coral}>
          已用 {spendPct}%
        </AppText>
        <AppText size="xs" color={colors.textLighter}>
          月末
        </AppText>
      </View>
    </View>
  );
}

function FrequencyDots({ meta }: { meta: FrequencyMeta }) {
  const count = meta.count;
  const maxDots = Math.min(count + 3, 20);
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: maxDots }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < count ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
      <AppText size="sm" color={colors.textLighter} style={styles.dotLabel}>
        {count}/月
      </AppText>
    </View>
  );
}

function SavingHighlight({ meta }: { meta: SavingMeta }) {
  return (
    <View style={styles.savingBox}>
      <AppText size="3xl" weight="bold" color={colors.honey}>
        ≈ ¥{Math.round(meta.totalSaving)}
      </AppText>
      <AppText size="sm" color={colors.textLight}>
        每月可节省
      </AppText>
    </View>
  );
}

export function InsightCard({ item }: InsightCardProps) {
  const accent = getAccent(item);

  const handlePress = () => {
    if (item.navigation) {
      router.push({
        pathname: item.navigation.route,
        params: item.navigation.params,
      } as Href);
    }
  };

  const content = (
    <Card radius="lg" shadow="sm" padding={14} style={styles.card}>
      <View style={[styles.bar, { backgroundColor: accent.bar }]} />
      <View style={styles.top}>
        <View style={[styles.emojiWrap, { backgroundColor: accent.emojiBg }]}>
          <AppText size="2xl">{item.emoji}</AppText>
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <AppText
              size="lg"
              weight="semibold"
              color={colors.text}
              style={styles.title}
            >
              {item.title}
            </AppText>
            {item.badge ? (
              <View style={[styles.badge, { backgroundColor: accent.badgeBg }]}>
                <AppText size="sm" weight="bold" color={accent.badgeText}>
                  {item.badge.text}
                </AppText>
              </View>
            ) : null}
          </View>
          <AppText size="base" color={colors.textLight} style={styles.desc}>
            {item.desc}
          </AppText>

          {item.type === "category-change" &&
          item.badge?.direction === "up" &&
          item.meta ? (
            <CompareRow meta={item.meta as CategoryChangeMeta} />
          ) : null}
          {item.type === "anomaly" && item.meta ? (
            <AnomalyDetail meta={item.meta as AnomalyMeta} />
          ) : null}
          {item.type === "pace" && item.meta ? (
            <PaceBar meta={item.meta as PaceMeta} />
          ) : null}
          {item.type === "frequency" && item.meta ? (
            <FrequencyDots meta={item.meta as FrequencyMeta} />
          ) : null}
          {item.type === "saving" && item.meta ? (
            <SavingHighlight meta={item.meta as SavingMeta} />
          ) : null}
        </View>
      </View>
    </Card>
  );

  if (item.navigation) {
    return <Pressable onPress={handlePress}>{content}</Pressable>;
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    position: "relative",
  },
  bar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  emojiWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 3,
  },
  title: {
    flex: 1,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  desc: {
    lineHeight: 18,
  },
  compareRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  compareItem: {
    flex: 1,
    backgroundColor: colors.cream,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.creamDark,
  },
  anomalyDetail: {
    marginTop: 10,
    backgroundColor: colors.lavenderPale,
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  anomalyMeta: {
    alignItems: "flex-end",
  },
  paceWrap: {
    marginTop: 10,
  },
  paceTrack: {
    height: 8,
    backgroundColor: colors.creamDark,
    borderRadius: 4,
    overflow: "hidden",
  },
  paceFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.honey,
  },
  paceLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    flexWrap: "wrap",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.lavender,
  },
  dotInactive: {
    backgroundColor: colors.creamDark,
  },
  dotLabel: {
    marginLeft: 4,
  },
  savingBox: {
    marginTop: 10,
    backgroundColor: colors.honeyPale,
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});

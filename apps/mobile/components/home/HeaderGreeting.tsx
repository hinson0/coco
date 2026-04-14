import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppText } from "../ui/AppText";
import { colors, radii, shadows } from "../../constants/theme";

const CN_MONTH = [
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
  "十",
  "十一",
  "十二",
];
const CN_DAY_TENS = ["", "十", "二十", "三十"];
const CN_DAY_UNITS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const CN_WEEKDAY = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const WEATHER_EMOJI = ["☀️", "🌤️", "⛅", "🌦️", "🌧️", "❄️"];

function cnDay(d: number): string {
  if (d <= 10) return CN_DAY_UNITS[d];
  if (d < 20) return "十" + CN_DAY_UNITS[d - 10];
  const tens = Math.floor(d / 10);
  const units = d % 10;
  return CN_DAY_TENS[tens] + (units > 0 ? CN_DAY_UNITS[units] : "");
}

function getChineseDate(): string {
  const now = new Date();
  const month = CN_MONTH[now.getMonth()];
  const day = cnDay(now.getDate());
  const weekday = CN_WEEKDAY[now.getDay()];
  // Fixed weather for now — could be dynamic from API
  return `${month}月${day}日 ${weekday}`;
}

export function HeaderGreeting() {
  const dateStr = getChineseDate();

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <AppText size="lg" color={colors.textLighter} style={styles.date}>
          {dateStr}
        </AppText>
        <AppText
          size="6xl"
          weight="bold"
          color={colors.text}
          style={styles.title}
        >
          CoCo记账
        </AppText>
      </View>
      <LinearGradient
        colors={[colors.sagePale, colors.coralPale]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.avatar}
      >
        <AppText style={styles.avatarEmoji}>🌿</AppText>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  left: {
    flex: 1,
  },
  date: {
    marginBottom: 4,
  },
  title: {
    letterSpacing: -0.5,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },
  avatarEmoji: {
    fontSize: 22,
  },
});

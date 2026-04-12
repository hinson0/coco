import { TouchableOpacity, View, StyleSheet } from "react-native";
import { AppText } from "../ui/AppText";
import { Badge, type BadgeVariant } from "../ui/Badge";
import { colors, radii } from "../../constants/theme";

interface MenuItemProps {
  readonly icon: string;
  readonly iconBg: string;
  readonly title: string;
  readonly desc?: string;
  readonly badge?: { text: string; variant: BadgeVariant };
  readonly onPress?: () => void;
}

export function MenuItem({
  icon,
  iconBg,
  title,
  desc,
  badge,
  onPress,
}: MenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        <AppText size="3xl">{icon}</AppText>
      </View>
      <View style={styles.info}>
        <AppText size="xl" weight="medium">
          {title}
        </AppText>
        {desc ? (
          <AppText
            size="base"
            color={colors.textLighter}
            style={{ marginTop: 1 }}
          >
            {desc}
          </AppText>
        ) : null}
      </View>
      {badge ? <Badge text={badge.text} variant={badge.variant} /> : null}
      <AppText size="xl" color={colors.textLighter}>
        ›
      </AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1 },
});

import { View, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { colors } from "../../constants/theme";

export type BadgeVariant = "ai" | "new" | "pro";

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  ai: { bg: colors.sage, text: colors.white },
  new: { bg: colors.coralPale, text: colors.coral },
  pro: { bg: colors.honeyPale, text: colors.honey },
};

interface BadgeProps {
  readonly text: string;
  readonly variant: BadgeVariant;
}

export function Badge({ text, variant }: BadgeProps) {
  const v = variantStyles[variant];
  const style: ViewStyle = {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: v.bg,
  };
  return (
    <View style={style}>
      <AppText size="xs" weight="bold" color={v.text}>
        {text}
      </AppText>
    </View>
  );
}

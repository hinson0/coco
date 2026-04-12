import { TouchableOpacity, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { colors, radii, shadows } from "../../constants/theme";

interface ChipProps {
  readonly label: string;
  readonly icon?: string;
  readonly active?: boolean;
  readonly onPress?: () => void;
}

export function Chip({ label, icon, active = false, onPress }: ChipProps) {
  const containerStyle: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: radii.full,
    backgroundColor: active ? colors.sage : colors.white,
    ...(active ? {} : shadows.sm),
  };
  const textColor = active ? colors.white : colors.textLight;

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon ? (
        <AppText size="xl" color={textColor}>
          {icon}
        </AppText>
      ) : null}
      <AppText size="md" weight="semibold" color={textColor}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

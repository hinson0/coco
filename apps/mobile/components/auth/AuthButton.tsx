import { Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { AppText } from "../ui/AppText";
import { colors, shadows } from "../../constants/theme";

interface AuthButtonProps {
  readonly title: string;
  readonly onPress: () => void;
  readonly loading?: boolean;
}

export function AuthButton({ title, onPress, loading }: AuthButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <AppText size="2xl" weight="semibold" color={colors.white}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.sage,
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});

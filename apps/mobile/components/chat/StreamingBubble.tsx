import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { colors, radii, shadows, spacing } from "../../constants/theme";
import { AppText } from "../ui/AppText";

interface StreamingBubbleProps {
  readonly text: string;
}

function BlinkingCursor() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 450 }),
        withTiming(1, { duration: 450 }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.Text style={[styles.cursor, style]}>▍</Animated.Text>;
}

export function StreamingBubble({ text }: StreamingBubbleProps) {
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <AppText size="base">🌿</AppText>
      </View>
      <View style={styles.bubble}>
        <AppText size="xl" color={colors.text}>
          {text}
          <BlinkingCursor />
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    alignSelf: "flex-start",
    maxWidth: "85%",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.sagePale,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
    marginTop: 2,
  },
  bubble: {
    flexShrink: 1,
    borderRadius: radii.lg,
    borderTopLeftRadius: 6,
    backgroundColor: colors.white,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    ...shadows.md,
  },
  cursor: {
    color: colors.sage,
  },
});

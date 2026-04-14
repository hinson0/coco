import { useEffect } from "react";
import { type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../../constants/theme";

interface PulseDotProps {
  readonly size?: number;
  readonly color?: string;
}

export function PulseDot({ size = 6, color = colors.sage }: PulseDotProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 700 }),
        withTiming(1, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const dotStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
  };

  return <Animated.View style={[dotStyle, animatedStyle]} />;
}

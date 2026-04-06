import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { AppText } from '../ui/AppText';
import { colors, radii, spacing, shadows } from '../../constants/theme';

const DOT_DELAY = 150;

function AnimatedDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0.3, { duration: 300 }),
        ),
        -1,
        false,
      ),
    );
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 300 }),
          withTiming(0, { duration: 300 }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

export function TypingIndicator() {
  return (
    <View style={styles.row}>
      {/* AI Avatar */}
      <View style={styles.avatar}>
        <AppText size="base">🌿</AppText>
      </View>

      {/* Bubble with dots */}
      <View style={styles.bubble}>
        <AnimatedDot delay={0} />
        <AnimatedDot delay={DOT_DELAY} />
        <AnimatedDot delay={DOT_DELAY * 2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.sagePale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderTopLeftRadius: 6,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    ...shadows.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sage,
  },
});

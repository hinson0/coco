import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withDelay,
  interpolateColor,
} from 'react-native-reanimated';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';

interface VoiceRecordingOverlayProps {
  readonly visible: boolean;
  readonly state: 'recording' | 'cancelling';
  readonly seconds: number;
}

const BAR_COUNT = 7;
const BAR_PERIODS = [400, 550, 350, 600, 450, 500, 380];
const BAR_BASE_HEIGHTS = [20, 35, 15, 45, 25, 40, 30];

function AnimatedBar({ index, isCancelling }: { index: number; isCancelling: boolean }) {
  const height = useSharedValue(BAR_BASE_HEIGHTS[index]);
  const colorProgress = useSharedValue(0);

  useEffect(() => {
    if (isCancelling) {
      height.value = withTiming(8, { duration: 200 });
      colorProgress.value = withTiming(1, { duration: 200 });
    } else {
      colorProgress.value = withTiming(0, { duration: 200 });
      height.value = withDelay(
        index * 60,
        withRepeat(
          withTiming(
            BAR_BASE_HEIGHTS[index] + 15,
            { duration: BAR_PERIODS[index] },
          ),
          -1,
          true,
        ),
      );
    }
  }, [isCancelling, height, colorProgress, index]);

  const barStyle = useAnimatedStyle(() => ({
    height: height.value,
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [colors.sage, colors.coral],
    ),
  }));

  return <Animated.View style={[styles.bar, barStyle]} />;
}

export function VoiceRecordingOverlay({ visible, state, seconds }: VoiceRecordingOverlayProps) {
  const translateY = useSharedValue(300);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 150 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(300, { duration: 200 });
    }
  }, [visible, opacity, translateY]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    pointerEvents: opacity.value > 0 ? 'auto' as const : 'none' as const,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const isCancelling = state === 'cancelling';

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Animated.View style={styles.barsContainer}>
          {Array.from({ length: BAR_COUNT }, (_, i) => (
            <AnimatedBar key={i} index={i} isCancelling={isCancelling} />
          ))}
        </Animated.View>

        <AppText size="2xl" weight="semibold" color={colors.sageLight} style={styles.timer}>
          {seconds}"
        </AppText>

        <AppText
          size="md"
          weight="medium"
          color={isCancelling ? colors.coral : 'rgba(255,255,255,0.5)'}
        >
          {isCancelling ? '松开取消' : '↑ 上滑取消'}
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(58,48,40,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  card: {
    width: 200,
    height: 200,
    backgroundColor: 'rgba(58,48,40,0.88)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 60,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
  timer: {
    marginTop: 4,
  },
});

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
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

// 底部波形条数量和参数
const BAR_COUNT = 40;

function generateBarParams() {
  const params = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    // 中间高两边低的基础波形
    const center = BAR_COUNT / 2;
    const dist = Math.abs(i - center) / center;
    const baseHeight = 6 + (1 - dist) * 18;
    const period = 300 + Math.sin(i * 0.7) * 200;
    const amplitude = 4 + (1 - dist) * 10;
    params.push({ baseHeight, period, amplitude });
  }
  return params;
}

const BAR_PARAMS = generateBarParams();

function WaveBar({ index, isCancelling }: { index: number; isCancelling: boolean }) {
  const { baseHeight, period, amplitude } = BAR_PARAMS[index];
  const height = useSharedValue(baseHeight);
  const colorProgress = useSharedValue(0);

  useEffect(() => {
    if (isCancelling) {
      height.value = withTiming(4, { duration: 200 });
      colorProgress.value = withTiming(1, { duration: 200 });
    } else {
      colorProgress.value = withTiming(0, { duration: 200 });
      height.value = withDelay(
        index * 30,
        withRepeat(
          withTiming(baseHeight + amplitude, { duration: period }),
          -1,
          true,
        ),
      );
    }
  }, [isCancelling, height, colorProgress, index, baseHeight, period, amplitude]);

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
  const translateY = useSharedValue(80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 150 });
      translateY.value = withTiming(0, { duration: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(80, { duration: 200 });
    }
  }, [visible, opacity, translateY]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
    pointerEvents: opacity.value > 0 ? 'auto' as const : 'none' as const,
  }));

  const isCancelling = state === 'cancelling';

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <AppText
        size="md"
        weight="medium"
        color={isCancelling ? colors.coral : colors.sage}
        style={styles.hint}
      >
        {isCancelling ? '松开取消' : `松手发送 ${seconds}",  上移取消`}
      </AppText>

      <View style={styles.waveContainer}>
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <WaveBar key={i} index={i} isCancelling={isCancelling} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 12,
    paddingTop: 10,
    backgroundColor: colors.cream,
    zIndex: 100,
  },
  hint: {
    textAlign: 'center',
    marginBottom: 10,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 36,
    paddingHorizontal: 20,
  },
  bar: {
    width: 2.5,
    borderRadius: 1.5,
  },
});

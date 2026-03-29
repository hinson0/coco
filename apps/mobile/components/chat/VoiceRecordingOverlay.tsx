import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';

interface VoiceRecordingOverlayProps {
  readonly visible: boolean;
  readonly state: 'recording' | 'cancelling';
  readonly seconds: number;
  readonly metering: number; // 0~1 归一化音量
}

// 底部波形条
const BAR_COUNT = 40;

// 每根条的随机系数（固定种子，保证每次渲染一致）
const BAR_RANDOM = Array.from({ length: BAR_COUNT }, (_, i) => {
  const center = BAR_COUNT / 2;
  const dist = Math.abs(i - center) / center;
  return {
    // 中间高两边低的权重
    weight: 1 - dist * 0.6,
    // 轻微随机偏移让波形不完全对称
    jitter: Math.sin(i * 2.3) * 0.3 + Math.cos(i * 1.7) * 0.2,
  };
});

const MIN_HEIGHT = 3;
const MAX_HEIGHT = 30;

function WaveBar({ index, metering, isCancelling }: { index: number; metering: number; isCancelling: boolean }) {
  const height = useSharedValue(MIN_HEIGHT);
  const colorProgress = useSharedValue(0);

  const { weight, jitter } = BAR_RANDOM[index];

  useEffect(() => {
    if (isCancelling) {
      height.value = withTiming(MIN_HEIGHT, { duration: 200 });
      colorProgress.value = withTiming(1, { duration: 200 });
    } else {
      colorProgress.value = withTiming(0, { duration: 200 });
      // 音量驱动高度：metering(0~1) * weight * jitter
      const level = Math.max(0, Math.min(1, metering + jitter * metering));
      const targetHeight = MIN_HEIGHT + level * weight * (MAX_HEIGHT - MIN_HEIGHT);
      height.value = withTiming(targetHeight, { duration: 80 });
    }
  }, [isCancelling, metering, height, colorProgress, weight, jitter]);

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

export function VoiceRecordingOverlay({ visible, state, seconds, metering }: VoiceRecordingOverlayProps) {
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
          <WaveBar key={i} index={i} metering={metering} isCancelling={isCancelling} />
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

import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';

interface VoiceRecordingOverlayProps {
  readonly visible: boolean;
  readonly state: 'recording' | 'cancelling';
  readonly metering: number; // 0~1 归一化音量
}

// ─── 声纹波形配置 ───
const BAR_COUNT = 40;

const BAR_RANDOM = Array.from({ length: BAR_COUNT }, (_, i) => {
  const center = BAR_COUNT / 2;
  const dist = Math.abs(i - center) / center;
  return {
    weight: 1 - dist * 0.6,
    jitter: Math.sin(i * 2.3) * 0.3 + Math.cos(i * 1.7) * 0.2,
  };
});

const MIN_HEIGHT = 4;
const MAX_HEIGHT = 36;

function WaveBar({ index, metering, isCancelling }: { index: number; metering: number; isCancelling: boolean }) {
  const height = useSharedValue(MIN_HEIGHT);
  const colorProgress = useSharedValue(0);
  const isAutoAnimatingRef = useRef(false);

  const { weight, jitter } = BAR_RANDOM[index];

  // 每根 bar 独立的自主动画参数（错开时间和幅度）
  const barDelay = (index % 7) * 60;
  const barPeriod = 500 + (index % 5) * 80;
  const barMinScale = 0.15 + weight * 0.1;
  const barMaxScale = 0.35 + weight * 0.35;

  // 自主呼吸动画：metering 无数据时立即启动
  useEffect(() => {
    if (isCancelling || metering > 0) return;
    if (isAutoAnimatingRef.current) return;
    isAutoAnimatingRef.current = true;
    const minH = MIN_HEIGHT + barMinScale * (MAX_HEIGHT - MIN_HEIGHT);
    const maxH = MIN_HEIGHT + barMaxScale * (MAX_HEIGHT - MIN_HEIGHT);
    height.value = withDelay(
      barDelay,
      withRepeat(
        withSequence(
          withTiming(maxH, { duration: barPeriod, easing: Easing.inOut(Easing.ease) }),
          withTiming(minH, { duration: barPeriod, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
  }, [isCancelling, metering, height, barDelay, barPeriod, barMinScale, barMaxScale]);

  // 数据驱动动画 + 取消状态
  useEffect(() => {
    if (isCancelling) {
      isAutoAnimatingRef.current = false;
      height.value = withTiming(MIN_HEIGHT, { duration: 200 });
      colorProgress.value = withTiming(1, { duration: 200 });
      return;
    }

    colorProgress.value = withTiming(0, { duration: 200 });

    if (metering > 0) {
      isAutoAnimatingRef.current = false;
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

// ─── 脉冲圆环 ───
function PulseRing({ metering, isCancelling }: { metering: number; isCancelling: boolean }) {
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.3);
  const outerScale = useSharedValue(1);
  const outerOpacity = useSharedValue(0.15);
  const breathScale = useSharedValue(1);
  const colorProgress = useSharedValue(0);

  // 呼吸动画
  useEffect(() => {
    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [breathScale]);

  useEffect(() => {
    if (isCancelling) {
      colorProgress.value = withTiming(1, { duration: 200 });
      ringScale.value = withTiming(1.05, { duration: 200 });
      ringOpacity.value = withTiming(0.5, { duration: 200 });
      outerScale.value = withTiming(1.1, { duration: 200 });
      outerOpacity.value = withTiming(0.25, { duration: 200 });
    } else {
      colorProgress.value = withTiming(0, { duration: 200 });
      // 内环：音量驱动
      const scale = 1 + metering * 0.15;
      const opacity = 0.2 + metering * 0.4;
      ringScale.value = withTiming(scale, { duration: 100 });
      ringOpacity.value = withTiming(opacity, { duration: 100 });
      // 外环：更大的脉冲
      const oScale = 1 + metering * 0.25;
      const oOpacity = 0.08 + metering * 0.18;
      outerScale.value = withTiming(oScale, { duration: 120 });
      outerOpacity.value = withTiming(oOpacity, { duration: 120 });
    }
  }, [isCancelling, metering, ringScale, ringOpacity, outerScale, outerOpacity, colorProgress]);

  const innerRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value * breathScale.value }],
    opacity: ringOpacity.value,
    borderColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [colors.sage, colors.coral],
    ),
  }));

  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outerScale.value * breathScale.value }],
    opacity: outerOpacity.value,
    borderColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [colors.sage, colors.coral],
    ),
  }));

  const iconBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [colors.sagePale, colors.coralPale],
    ),
  }));

  return (
    <View style={styles.pulseContainer}>
      {/* 外环 */}
      <Animated.View style={[styles.ring, styles.outerRing, outerRingStyle]} />
      {/* 内环 */}
      <Animated.View style={[styles.ring, styles.innerRing, innerRingStyle]} />
      {/* 中心图标 */}
      <Animated.View style={[styles.centerIcon, iconBgStyle]}>
        <AppText size="3xl">{isCancelling ? '✕' : '🎙️'}</AppText>
      </Animated.View>
    </View>
  );
}

export function VoiceRecordingOverlay({ visible, state, metering }: VoiceRecordingOverlayProps) {
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

  const isCancelling = state === 'cancelling';

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
    pointerEvents: opacity.value > 0 ? 'auto' as const : 'none' as const,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* ── 声纹波形（顶部） ── */}
      <View style={styles.waveContainer}>
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <WaveBar key={i} index={i} metering={metering} isCancelling={isCancelling} />
        ))}
      </View>

      {/* ── 提示文字（声纹与圆环之间） ── */}
      <AppText
        size="md"
        weight="medium"
        color={isCancelling ? colors.coral : colors.sage}
        style={styles.hint}
      >
        {isCancelling ? '松开取消' : '松手发送 · 上移取消'}
      </AppText>

      {/* ── 脉冲圆环 + 图标 ── */}
      <PulseRing metering={metering} isCancelling={isCancelling} />
    </Animated.View>
  );
}

const RING_SIZE = 88;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 56,
    paddingTop: 16,
    backgroundColor: colors.cream,
    zIndex: 100,
    alignItems: 'center',
  },
  // ─── 声纹波形 ───
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 42,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  bar: {
    width: 2.5,
    borderRadius: 1.5,
  },
  // ─── 脉冲圆环 ───
  pulseContainer: {
    width: RING_SIZE + 40,
    height: RING_SIZE + 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ring: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 2,
  },
  innerRing: {
    width: RING_SIZE,
    height: RING_SIZE,
  },
  outerRing: {
    width: RING_SIZE + 28,
    height: RING_SIZE + 28,
  },
  centerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ─── 提示文字 ───
  hint: {
    textAlign: 'center',
    marginBottom: 12,
  },
});

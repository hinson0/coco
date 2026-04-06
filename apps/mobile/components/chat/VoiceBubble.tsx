import { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
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

interface VoiceBubbleProps {
  readonly role: 'user' | 'assistant';
  readonly duration: number;
  readonly isPlaying: boolean;
  readonly onPlay: () => void;
  readonly transcription?: string;
  readonly status?: 'sending' | 'transcribing' | 'done';
}

const BAR_HEIGHTS = [6, 12, 18] as const;

function AnimatedBar({ height, delay, isPlaying, barColor }: { height: number; delay: number; isPlaying: boolean; barColor: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isPlaying) {
      scale.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(0.3, { duration: 300 }),
            withTiming(1, { duration: 300 }),
          ),
          -1,
          false,
        ),
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [isPlaying, delay, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }));

  return (
    <View style={{ height: 18, justifyContent: 'center', alignItems: 'center', width: 3 }}>
      <Animated.View style={[styles.bar, { height, backgroundColor: barColor }, animatedStyle]} />
    </View>
  );
}

// 根据时长计算气泡宽度：1秒=80, 每多1秒+6, 最大220
function getBubbleWidth(duration: number): number {
  return Math.min(220, 80 + Math.max(0, duration - 1) * 6);
}

export function VoiceBubble({ role, duration, isPlaying, onPlay, transcription, status }: VoiceBubbleProps) {
  const isUser = role === 'user';
  const bubbleStyle = isUser ? styles.bubbleUser : styles.bubbleAssistant;
  const barColor = isUser ? colors.white : colors.sage;
  const bubbleWidth = getBubbleWidth(duration);

  return (
    <View style={[styles.wrapper, isUser ? styles.wrapperUser : styles.wrapperAssistant]}>
      <Pressable onPress={onPlay} style={[styles.bubble, bubbleStyle, { width: bubbleWidth }]}>
        <View style={styles.content}>
          {BAR_HEIGHTS.map((h, i) => (
            <AnimatedBar key={i} height={h} delay={i * 120} isPlaying={isPlaying} barColor={barColor} />
          ))}
          <AppText
            size="md"
            weight="medium"
            color={isUser ? colors.white : colors.sage}
            style={styles.duration}
          >
            {duration}"
          </AppText>
        </View>
      </Pressable>

      {transcription ? (
        <AppText size="md" color={colors.textLighter} style={styles.transcription}>
          {transcription}
        </AppText>
      ) : null}
      {status === 'transcribing' ? (
        <AppText size="md" color={colors.textLighter} style={styles.transcription}>
          识别中...
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    maxWidth: '75%',
  },
  wrapperUser: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  wrapperAssistant: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
  },
  bubbleUser: {
    backgroundColor: colors.sage,
    borderTopRightRadius: 6,
  },
  bubbleAssistant: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 6,
    ...shadows.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
  duration: {
    marginLeft: spacing.md,
  },
  transcription: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
});

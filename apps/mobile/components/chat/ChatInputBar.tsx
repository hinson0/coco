import { useState, useRef } from 'react';
import { View, TextInput, Pressable, StyleSheet, PanResponder } from 'react-native';
import { AppText } from '../ui/AppText';
import { QuickActions } from './QuickActions';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { colors, radii, spacing, shadows } from '../../constants/theme';

// ─── 滑动取消阈值（向上滑动 50pt 触发） ───
const CANCEL_THRESHOLD = 50;

// ─── 录音状态 ───
type RecordingState = 'idle' | 'recording' | 'cancelling';

export type { RecordingState };

// ─── Props ───
interface ChatInputBarProps {
  readonly onSendText: (text: string) => void;
  readonly onCamera: () => void;
  readonly onVoice: (base64: string, durationSeconds: number) => void;
  readonly onQuickAction: (text: string) => void;
  readonly recordingState: RecordingState;
  readonly recordingSeconds: number;
  readonly onRecordingStateChange: (state: RecordingState) => void;
  readonly onRecordingSecondsChange: (seconds: number) => void;
}

export function ChatInputBar({
  onSendText, onCamera, onVoice, onQuickAction,
  recordingState, recordingSeconds, onRecordingStateChange, onRecordingSecondsChange,
}: ChatInputBarProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [plusExpanded, setPlusExpanded] = useState(false);
  const hasText = text.trim().length > 0;
  const { startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  // useRef 镜像 recordingState，PanResponder 回调中读 ref 避免闭包陷阱
  const recordingStateRef = useRef<RecordingState>('idle');
  function setRecordingStateSync(s: RecordingState) {
    recordingStateRef.current = s;
    onRecordingStateChange(s);
  }

  // useRef 镜像 onVoice 回调，避免 PanResponder 闭包捕获旧 prop
  const onVoiceRef = useRef(onVoice);
  onVoiceRef.current = onVoice;

  const startYRef = useRef(0);

  // ─── 文字提交 ───
  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText('');
  }

  // ─── 模式切换 ───
  function toggleMode() {
    setMode((prev) => (prev === 'text' ? 'voice' : 'text'));
    setPlusExpanded(false);
  }

  // ─── + 按钮 ───
  function handlePlus() {
    setPlusExpanded((prev) => !prev);
  }

  function handleQuickAction(actionText: string) {
    setPlusExpanded(false);
    onQuickAction(actionText);
  }

  // ─── PanResponder 长按录音手势（所有回调读 ref，不读 state） ───
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: async (_evt, gestureState) => {
        startYRef.current = gestureState.y0;
        const started = await startRecording();
        if (started) {
          setRecordingStateSync('recording');
        }
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (recordingStateRef.current === 'idle') return;
        const dy = startYRef.current - gestureState.moveY;
        if (dy > CANCEL_THRESHOLD) {
          setRecordingStateSync('cancelling');
        } else {
          setRecordingStateSync('recording');
        }
      },
      onPanResponderRelease: async () => {
        const current = recordingStateRef.current;
        if (current === 'cancelling') {
          await cancelRecording();
          setRecordingStateSync('idle');
        } else if (current === 'recording') {
          const result = await stopRecording();
          setRecordingStateSync('idle');
          if (result) {
            onVoiceRef.current(result.base64, result.durationSeconds);
          }
        }
      },
      onPanResponderTerminate: async () => {
        await cancelRecording();
        setRecordingStateSync('idle');
      },
    }),
  ).current;

  // ─── 录音按钮文字 ───
  const voiceBtnText =
    recordingState === 'cancelling'
      ? '松开取消'
      : recordingState === 'recording'
        ? `松开发送 ${recordingSeconds}s`
        : '按住说话';

  const voiceBtnBg =
    recordingState === 'cancelling'
      ? '#fde8e2'
      : recordingState === 'recording'
        ? colors.sagePale
        : colors.cream;

  return (
    <View>
      <QuickActions visible={plusExpanded} onSelect={handleQuickAction} />

      <View style={styles.container}>
        {/* 📷 相机按钮 — 两种模式都显示 */}
        <Pressable onPress={onCamera} style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}>
          <AppText size="2xl">📷</AppText>
        </Pressable>

        {mode === 'text' ? (
          <>
            {/* 文字模式：输入框 */}
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="记一笔..."
              placeholderTextColor={colors.textLighter}
              returnKeyType="default"
              style={[styles.input, { maxHeight: 100 }]}
              multiline
            />

            {hasText ? (
              /* 有文字 → 发送按钮 */
              <Pressable onPress={handleSubmit} style={({ pressed }) => [styles.sendBtn, pressed && styles.btnPressed]}>
                <AppText size="lg" weight="bold" color={colors.white}>↑</AppText>
              </Pressable>
            ) : (
              <>
                {/* 无文字 → 🎤 + ➕ */}
                <Pressable onPress={toggleMode} style={({ pressed }) => [styles.iconBtn, styles.voiceBtn, pressed && styles.btnPressed]}>
                  <AppText size="2xl">🎤</AppText>
                </Pressable>
                <Pressable onPress={handlePlus} style={({ pressed }) => [styles.iconBtn, styles.plusBtn, pressed && styles.btnPressed]}>
                  <AppText size="4xl" weight="regular" color={colors.white}>+</AppText>
                </Pressable>
              </>
            )}
          </>
        ) : (
          <>
            {/* 语音模式：按住说话 */}
            <View
              style={[styles.voiceArea, { backgroundColor: voiceBtnBg }]}
              {...panResponder.panHandlers}
            >
              <AppText
                size="lg"
                weight="medium"
                color={recordingState === 'cancelling' ? colors.coral : colors.text}
              >
                {voiceBtnText}
              </AppText>
            </View>

            {/* ⌨️ 切回文字模式 */}
            <Pressable onPress={toggleMode} style={({ pressed }) => [styles.iconBtn, styles.voiceBtn, pressed && styles.btnPressed]}>
              <AppText size="2xl">⌨️</AppText>
            </Pressable>
            <Pressable onPress={handlePlus} style={({ pressed }) => [styles.iconBtn, styles.plusBtn, pressed && styles.btnPressed]}>
              <AppText size="4xl" weight="regular" color={colors.white}>+</AppText>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.cream,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBtn: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.creamDeeper,
  },
  plusBtn: {
    backgroundColor: colors.sage,
    ...shadows.sm,
  },
  btnPressed: {
    opacity: 0.75,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.creamDeeper,
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    fontSize: 14,
    color: colors.text,
  },
  voiceArea: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.creamDeeper,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

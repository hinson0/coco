import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  PanResponder,
  Keyboard,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { AppText } from "../ui/AppText";
import { QuickActions } from "./QuickActions";
import { useVoiceRecorder } from "../../hooks/useVoiceRecorder";
import { colors, radii, spacing, shadows } from "../../constants/theme";

// ─── 长按阈值（ms） ───
const LONG_PRESS_DELAY = 300;
// ─── 滑动取消阈值（向上滑动 50pt 触发） ───
const CANCEL_THRESHOLD = 50;

// ─── 录音状态 ───
type RecordingState = "idle" | "recording" | "cancelling";

export type { RecordingState };

// ─── Props ───
interface ChatInputBarProps {
  readonly onSendText: (text: string) => void;
  readonly onCamera: () => void;
  readonly onVoice: (base64: string, durationSeconds: number) => void;
  readonly onQuickAction: (text: string) => void;
  readonly recordingState: RecordingState;
  readonly onRecordingStateChange: (state: RecordingState) => void;
  readonly onMeteringChange?: (level: number) => void;
}

export function ChatInputBar({
  onSendText,
  onCamera,
  onVoice,
  onQuickAction,
  recordingState: _recordingState,
  onRecordingStateChange,
  onMeteringChange,
}: ChatInputBarProps) {
  const [text, setText] = useState("");
  const [plusExpanded, setPlusExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const hasText = text.trim().length > 0;
  const inputRef = useRef<TextInput>(null);
  const { startRecording, stopRecording, cancelRecording, metering } =
    useVoiceRecorder();

  // 将 metering 值回传给父组件
  useEffect(() => {
    onMeteringChange?.(metering);
  }, [metering, onMeteringChange]);

  // useRef 镜像 recordingState，PanResponder 回调中读 ref 避免闭包陷阱
  const recordingStateRef = useRef<RecordingState>("idle");
  function setRecordingStateSync(s: RecordingState) {
    recordingStateRef.current = s;
    onRecordingStateChange(s);
  }

  // useRef 镜像 onVoice 回调
  const onVoiceRef = useRef(onVoice);
  onVoiceRef.current = onVoice;

  const startYRef = useRef(0);

  // 长按计时器
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didTriggerVoiceRef = useRef(false);
  // ─── 文字提交 ───
  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText("");
  }

  // ─── + 按钮 ───
  function handlePlus() {
    setPlusExpanded((prev) => !prev);
  }

  function handleQuickAction(actionText: string) {
    setPlusExpanded(false);
    onQuickAction(actionText);
  }

  // ─── 切换语音/文字模式 ───
  function toggleVoiceMode() {
    // 正在录音时先取消，避免资源泄漏
    if (recordingStateRef.current !== "idle") {
      setRecordingStateSync("idle");
      cancelRecording();
    }
    setVoiceMode((prev) => {
      if (prev) {
        // 切回文字模式，聚焦输入框
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        // 切到语音模式，收起键盘
        Keyboard.dismiss();
        setPlusExpanded(false);
      }
      return !prev;
    });
  }

  // ─── 按住说话手势（无 300ms 延迟，按下即录） ───
  const voicePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: async (_evt, gestureState) => {
        startYRef.current = gestureState.y0;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setRecordingStateSync("recording");
        const started = await startRecording();
        if (!started) {
          setRecordingStateSync("idle");
        }
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (recordingStateRef.current === "idle") return;
        const dy = startYRef.current - gestureState.moveY;
        if (dy > CANCEL_THRESHOLD) {
          setRecordingStateSync("cancelling");
        } else {
          setRecordingStateSync("recording");
        }
      },
      onPanResponderRelease: async () => {
        const current = recordingStateRef.current;
        setRecordingStateSync("idle");
        if (current === "cancelling") {
          await cancelRecording();
        } else if (current === "recording") {
          const result = await stopRecording();
          if (result) {
            onVoiceRef.current(result.base64, result.durationSeconds);
          }
        }
      },
      onPanResponderTerminate: async () => {
        if (recordingStateRef.current !== "idle") {
          setRecordingStateSync("idle");
          await cancelRecording();
        }
      },
    }),
  ).current;

  // ─── 聚焦/失焦 ───
  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);

  // 键盘隐藏时失焦，让手势层重新出现
  useEffect(() => {
    const event =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const sub = Keyboard.addListener(event, () => {
      inputRef.current?.blur();
    });
    return () => sub.remove();
  }, []);

  // ─── PanResponder：长按录音手势 ───
  // 仅在未聚焦 & 无文字时响应长按
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (_evt, gestureState) => {
        startYRef.current = gestureState.y0;
        didTriggerVoiceRef.current = false;

        // 设定长按计时器
        longPressTimerRef.current = setTimeout(async () => {
          didTriggerVoiceRef.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setRecordingStateSync("recording");
          const started = await startRecording();
          if (!started) {
            setRecordingStateSync("idle");
          }
        }, LONG_PRESS_DELAY);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (recordingStateRef.current === "idle") return;
        const dy = startYRef.current - gestureState.moveY;
        if (dy > CANCEL_THRESHOLD) {
          setRecordingStateSync("cancelling");
        } else {
          setRecordingStateSync("recording");
        }
      },
      onPanResponderRelease: async () => {
        // 清除长按计时器
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }

        // 如果没触发录音，当作普通点击 → 聚焦输入框
        if (!didTriggerVoiceRef.current) {
          inputRef.current?.focus();
          return;
        }

        const current = recordingStateRef.current;
        setRecordingStateSync("idle");
        if (current === "cancelling") {
          await cancelRecording();
        } else if (current === "recording") {
          const result = await stopRecording();
          if (result) {
            onVoiceRef.current(result.base64, result.durationSeconds);
          }
        }
      },
      onPanResponderTerminate: async () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (didTriggerVoiceRef.current) {
          setRecordingStateSync("idle");
          await cancelRecording();
        }
      },
    }),
  ).current;

  return (
    <View>
      <QuickActions visible={plusExpanded} onSelect={handleQuickAction} />

      <View style={styles.container}>
        {/* 📷 相机按钮 */}
        <Pressable
          onPress={onCamera}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && styles.btnPressed,
          ]}
        >
          <AppText size="2xl">📷</AppText>
        </Pressable>

        {/* 输入区：文字模式 or 按住说话模式 */}
        <View style={styles.inputWrapper}>
          {voiceMode ? (
            /* 按住说话按钮 */
            <View
              style={styles.holdToTalkBtn}
              {...voicePanResponder.panHandlers}
            >
              <AppText size="md" weight="medium" color={colors.textLight}>
                按住说话
              </AppText>
            </View>
          ) : (
            <>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                placeholder={focused ? "记一笔" : "记一笔或按住说话"}
                placeholderTextColor={colors.textLighter}
                returnKeyType="default"
                style={[styles.input, { maxHeight: 100 }]}
                multiline
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
              {/* 未聚焦且无文字时，盖一层手势层拦截点击/长按 */}
              {!focused && !hasText && (
                <View
                  style={styles.gestureOverlay}
                  {...panResponder.panHandlers}
                />
              )}
            </>
          )}
        </View>

        {hasText ? (
          /* 有文字 → 发送按钮 */
          <Pressable
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.sendBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <AppText size="lg" weight="bold" color={colors.white}>
              ↑
            </AppText>
          </Pressable>
        ) : (
          /* 无文字 → 🎤/⌨️ 切换 + ➕ */
          <>
            <Pressable
              onPress={toggleVoiceMode}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <AppText size="xl">{voiceMode ? "⌨️" : "🎤"}</AppText>
            </Pressable>
            <Pressable
              onPress={handlePlus}
              style={({ pressed }) => [
                styles.iconBtn,
                styles.plusBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <AppText size="4xl" weight="regular" color={colors.white}>
                +
              </AppText>
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.cream,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  plusBtn: {
    backgroundColor: colors.sage,
    ...shadows.sm,
  },
  btnPressed: {
    opacity: 0.75,
  },
  inputWrapper: {
    flex: 1,
    position: "relative",
  },
  gestureOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  input: {
    height: 44,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.creamDeeper,
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    fontSize: 15,
    color: colors.text,
  },
  holdToTalkBtn: {
    height: 44,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.creamDeeper,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
  },
});

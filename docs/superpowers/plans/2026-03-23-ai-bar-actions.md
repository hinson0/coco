# AI 页底部栏功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补全 AI 页底部栏三个按钮的功能：📷 相机拍照 OCR、🎤 语音模式录音 ASR、➕ 快捷操作面板。

**Architecture:** 将原生能力封装为独立 hook（`useCamera`、`useVoiceRecorder`），UI 扩展组件独立（`QuickActions`），`ChatInputBar` 管理文字/语音模式切换，`index.tsx` 负责串联。

**Tech Stack:** React Native, Expo SDK 55, expo-image-picker, expo-audio, expo-file-system, PanResponder

**Spec:** `docs/superpowers/specs/2026-03-23-ai-bar-actions-design.md`

**注意：** 项目当前无测试基础设施，本计划以实现+手动验证为主。

---

## 文件结构

| 操作 | 文件路径 | 职责 |
|------|----------|------|
| 新建 | `apps/mobile/hooks/useCamera.ts` | 封装 expo-image-picker 相机调用 |
| 新建 | `apps/mobile/hooks/useVoiceRecorder.ts` | 封装 expo-audio 录音逻辑 |
| 新建 | `apps/mobile/components/chat/QuickActions.tsx` | + 按钮的快捷操作面板 |
| 修改 | `apps/mobile/components/chat/ChatInputBar.tsx` | 增加 text/voice 模式切换、语音 UI、PanResponder 手势 |
| 修改 | `apps/mobile/app/index.tsx` | 接入 useCamera，修改回调签名 |
| 修改 | `apps/mobile/app.json` | 添加 expo-image-picker plugin，补充权限描述 |

---

### Task 1: 更新 app.json 配置

**Files:**
- Modify: `apps/mobile/app.json:32-37`

- [ ] **Step 1: 添加 expo-image-picker plugin 并补充权限描述**

将 `plugins` 数组从：
```json
"plugins": [
  "expo-router",
  "expo-audio",
  "expo-sqlite",
  "@react-native-community/datetimepicker"
]
```

改为：
```json
"plugins": [
  "expo-router",
  [
    "expo-image-picker",
    { "cameraPermission": "允许 Coco 使用相机拍摄小票进行记账" }
  ],
  [
    "expo-audio",
    { "microphonePermission": "允许 Coco 使用麦克风进行语音记账" }
  ],
  "expo-sqlite",
  "@react-native-community/datetimepicker"
]
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/app.json
git commit -m "chore: add expo-image-picker plugin and permission descriptions"
```

---

### Task 2: 实现 `useCamera` hook

**Files:**
- Create: `apps/mobile/hooks/useCamera.ts`

- [ ] **Step 1: 创建 useCamera hook**

```typescript
// apps/mobile/hooks/useCamera.ts
import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export function useCamera() {
  const pickImage = useCallback(async (): Promise<string | null> => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();

    if (!granted) {
      Alert.alert(
        '需要相机权限',
        '请在系统设置中允许 Coco 访问相机',
        [
          { text: '取消', style: 'cancel' },
          { text: '去设置', onPress: () => Linking.openSettings() },
        ],
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.6,
    });

    if (result.canceled) return null;
    return result.assets[0].base64 ?? null;
  }, []);

  return { pickImage };
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/hooks/useCamera.ts
git commit -m "feat: add useCamera hook for image picker"
```

---

### Task 3: 实现 `useVoiceRecorder` hook

**Files:**
- Create: `apps/mobile/hooks/useVoiceRecorder.ts`

- [ ] **Step 1: 创建 useVoiceRecorder hook**

```typescript
// apps/mobile/hooks/useVoiceRecorder.ts
import { useRef, useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system';

const MAX_DURATION_MS = 60_000;

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  // useRef 镜像 isRecording，避免 useCallback/PanResponder 闭包捕获过期值
  const isRecordingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setRecordingFlag = useCallback((value: boolean) => {
    isRecordingRef.current = value;
    setIsRecording(value);
  }, []);

  const readBase64 = useCallback(async (): Promise<string | null> => {
    const uri = recorder.uri;
    if (!uri) return null;
    return FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }, [recorder]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert(
        '需要麦克风权限',
        '请在系统设置中允许 Coco 访问麦克风',
        [
          { text: '取消', style: 'cancel' },
          { text: '去设置', onPress: () => Linking.openSettings() },
        ],
      );
      return false;
    }

    clearTimer();
    cancelledRef.current = false;
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecordingFlag(true);

    // 60 秒自动停止（await stop + 读取 base64，但不自动发送——由调用方通过 onAutoStop 回调处理）
    timerRef.current = setTimeout(async () => {
      await recorder.stop();
      setRecordingFlag(false);
    }, MAX_DURATION_MS);

    return true;
  }, [recorder, clearTimer, setRecordingFlag]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    clearTimer();
    // 读 ref 而非 state，避免闭包过期
    if (!isRecordingRef.current) return null;

    await recorder.stop();
    setRecordingFlag(false);

    if (cancelledRef.current) return null;
    return readBase64();
  }, [recorder, clearTimer, setRecordingFlag, readBase64]);

  const cancelRecording = useCallback(async (): Promise<void> => {
    clearTimer();
    cancelledRef.current = true;
    if (isRecordingRef.current) {
      await recorder.stop();
      setRecordingFlag(false);
    }
  }, [recorder, clearTimer, setRecordingFlag]);

  return { isRecording, startRecording, stopRecording, cancelRecording };
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/hooks/useVoiceRecorder.ts
git commit -m "feat: add useVoiceRecorder hook with recording and cancel support"
```

---

### Task 4: 实现 `QuickActions` 组件

**Files:**
- Create: `apps/mobile/components/chat/QuickActions.tsx`

- [ ] **Step 1: 创建 QuickActions 组件**

```typescript
// apps/mobile/components/chat/QuickActions.tsx
import { ScrollView, Pressable, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, spacing } from '../../constants/theme';

interface QuickAction {
  readonly icon: string;
  readonly label: string;
  readonly text: string;
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  { icon: '📅', label: '本周报告', text: '本周报告' },
  { icon: '📈', label: '月度趋势', text: '本月趋势' },
  { icon: '💰', label: '今日花费', text: '今天花了多少' },
  { icon: '🏷️', label: '分类统计', text: '各分类支出统计' },
];

interface QuickActionsProps {
  readonly visible: boolean;
  readonly onSelect: (text: string) => void;
}

export function QuickActions({ visible, onSelect }: QuickActionsProps) {
  if (!visible) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {QUICK_ACTIONS.map((action) => (
        <Pressable
          key={action.label}
          onPress={() => onSelect(action.text)}
          style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
        >
          <AppText size="md">{action.icon}</AppText>
          <AppText size="md" color={colors.text}>{action.label}</AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.creamDark,
    borderRadius: 20,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  itemPressed: {
    opacity: 0.75,
  },
});
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/components/chat/QuickActions.tsx
git commit -m "feat: add QuickActions component for plus button panel"
```

---

### Task 5: 重构 `ChatInputBar` — 模式切换 + 语音 UI + 手势

**Files:**
- Modify: `apps/mobile/components/chat/ChatInputBar.tsx`（完全重写）

这是最复杂的 task，包含：text/voice 模式切换、PanResponder 长按录音手势、滑动取消、录音计时显示。

- [ ] **Step 1: 重写 ChatInputBar**

完整替换 `ChatInputBar.tsx`：

```typescript
// apps/mobile/components/chat/ChatInputBar.tsx
import { useState, useRef, useEffect } from 'react';
import { View, TextInput, Pressable, StyleSheet, PanResponder } from 'react-native';
import { AppText } from '../ui/AppText';
import { QuickActions } from './QuickActions';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { colors, radii, spacing, shadows } from '../../constants/theme';

// ─── 滑动取消阈值（向上滑动 50pt 触发） ───
const CANCEL_THRESHOLD = 50;

// ─── Props ───
interface ChatInputBarProps {
  readonly onSendText: (text: string) => void;
  readonly onCamera: () => void;
  readonly onVoice: (audioBase64: string) => void;
  readonly onQuickAction: (text: string) => void;
}

// ─── 录音状态 ───
type RecordingState = 'idle' | 'recording' | 'cancelling';

export function ChatInputBar({ onSendText, onCamera, onVoice, onQuickAction }: ChatInputBarProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [plusExpanded, setPlusExpanded] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const hasText = text.trim().length > 0;
  const { startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  // useRef 镜像 recordingState，PanResponder 回调中读 ref 避免闭包陷阱
  const recordingStateRef = useRef<RecordingState>('idle');
  function setRecordingStateSync(s: RecordingState) {
    recordingStateRef.current = s;
    setRecordingState(s);
  }

  // useRef 镜像 onVoice 回调，避免 PanResponder 闭包捕获旧 prop
  const onVoiceRef = useRef(onVoice);
  onVoiceRef.current = onVoice;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startYRef = useRef(0);

  // ─── 录音计时器（仅在 idle <-> 非 idle 切换时启停，recording <-> cancelling 不重启） ───
  const wasRecordingRef = useRef(false);
  useEffect(() => {
    const isActive = recordingState !== 'idle';
    if (isActive && !wasRecordingRef.current) {
      // 从 idle 进入录音：启动计时器
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } else if (!isActive && wasRecordingRef.current) {
      // 从录音回到 idle：清除计时器
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingSeconds(0);
    }
    wasRecordingRef.current = isActive;
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recordingState]);

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
          const base64 = await stopRecording();
          setRecordingStateSync('idle');
          if (base64) {
            onVoiceRef.current(base64);
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
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd apps/mobile && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: 无类型错误。

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/components/chat/ChatInputBar.tsx
git commit -m "feat: refactor ChatInputBar with voice mode, PanResponder gesture, and QuickActions"
```

---

### Task 6: 接入 `index.tsx`

**Files:**
- Modify: `apps/mobile/app/index.tsx:22,131,250-255`

- [ ] **Step 1: 添加 useCamera import**

在 `index.tsx` 顶部 import 区域（第 22 行 `useChat` import 后面）添加：

```typescript
import { useCamera } from '../hooks/useCamera';
```

- [ ] **Step 2: 在 ChatScreen 中初始化 useCamera**

在第 131 行 `const { sendText, sendOcr, sendAsr, isLoading: isSending } = useChat();` 之后添加：

```typescript
const { pickImage } = useCamera();
```

- [ ] **Step 3: 修改 ChatInputBar 回调**

将第 250-255 行的 `ChatInputBar` 调用从：

```typescript
<ChatInputBar
  onSendText={sendText}
  onCamera={() => {/* OCR handled via camera picker */}}
  onVoice={() => {/* ASR handled via voice recorder */}}
  onPlus={() => {/* expand tool panel */}}
/>
```

改为：

```typescript
<ChatInputBar
  onSendText={sendText}
  onCamera={async () => {
    const base64 = await pickImage();
    if (base64) sendOcr(base64);
  }}
  onVoice={(base64) => sendAsr(base64)}
  onQuickAction={(actionText) => sendText(actionText)}
/>
```

- [ ] **Step 4: 验证 TypeScript 编译**

```bash
cd apps/mobile && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: 无类型错误。

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/app/index.tsx
git commit -m "feat: wire up camera, voice, and quick actions in ChatScreen"
```

---

### Task 7: 手动测试验证

- [ ] **Step 1: 启动开发服务器**

```bash
cd apps/mobile && npx expo start
```

- [ ] **Step 2: 验证文字模式布局**

打开 AI 页面，确认底栏布局：`📷 | [记一笔...] | 🎤 | +`
输入文字后确认右侧变为蓝色发送按钮，清空后恢复。

- [ ] **Step 3: 验证相机按钮**

点击 📷 → 应弹出系统相机权限请求 → 允许后启动相机 → 拍照后返回 → 触发 OCR 流程。

- [ ] **Step 4: 验证语音模式**

1. 点击 🎤 → 底栏切换为 `📷 | [按住说话] | ⌨️ | +`
2. 长按「按住说话」→ 显示「松开发送 Ns」
3. 松手 → 触发 ASR 流程
4. 长按后向上滑出 → 显示「松开取消」→ 松手取消录音
5. 点击 ⌨️ → 切回文字模式

- [ ] **Step 5: 验证 + 按钮**

点击 + → 输入栏上方展开快捷操作面板 → 点击「本周报告」→ 发送文字消息 → 面板收起。
再次点击 + → 面板展开，再点 → 面板收起。

- [ ] **Step 6: 最终提交（如有修复）**

```bash
git add -A && git commit -m "fix: address issues found during manual testing"
```

---

## 实现顺序说明

Tasks 1-4 相互独立，可以并行开发。Task 5 依赖 Task 3（useVoiceRecorder）和 Task 4（QuickActions）。Task 6 依赖 Task 2 和 Task 5。Task 7 依赖所有前置 task。

```
Task 1 (app.json) ──────────────────────────────┐
Task 2 (useCamera) ─────────────────────────────┤
Task 3 (useVoiceRecorder) ──┬── Task 5 (ChatInputBar) ──┬── Task 6 (index.tsx) ── Task 7 (验证)
Task 4 (QuickActions) ──────┘                            │
Task 2 (useCamera) ──────────────────────────────────────┘
```

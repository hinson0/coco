# 语音/ASR/OCR 功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复录音 0 秒 Bug、实现语音播放和声纹录音浮层、通过 Supabase Edge Functions 补齐 ASR/OCR/文本记账后端

**Architecture:** 前端录音修复 + 新建 VoiceRecordingOverlay 组件 + 数据层扩展 audio_uri/duration_seconds + Supabase Edge Functions 替代缺失的 BFF 后端。rule-engine 移至 shared 包实现跨端复用。

**Tech Stack:** React Native (Expo 55), expo-audio, react-native-reanimated, Supabase Edge Functions (Deno), 腾讯云 ASR/OCR SDK, 智谱 GLM-4.7-Flash

---

## 文件结构

### 修改的文件
| 文件 | 职责 |
|------|------|
| `packages/shared/src/types/chat.ts` | ChatMessage 新增 audio_uri、duration_seconds 字段 |
| `packages/shared/src/index.ts` | 新增 rule-engine 导出 |
| `apps/mobile/lib/db/schema.ts` | 迁移新增 chat_messages 两列 |
| `apps/mobile/hooks/useLocalChatMessages.ts` | INSERT/SELECT 支持新字段 |
| `apps/mobile/hooks/useVoiceRecorder.ts` | stopRecording 返回 { base64, durationSeconds } |
| `apps/mobile/hooks/useChat.ts` | sendAsr 乐观渲染+保存音频；sendOcr/sendText 改 API 路径 |
| `apps/mobile/components/chat/ChatInputBar.tsx` | recordingState 提升到 props；onVoice 签名变更 |
| `apps/mobile/components/chat/ChatBubble.tsx` | duration 从 message.duration_seconds 读取；传播 audio_uri/onPlay |
| `apps/mobile/components/chat/VoiceBubble.tsx` | 新增 status prop |
| `apps/mobile/app/index.tsx` | 管理 recordingState/playingMessageId；渲染 Overlay |
| `apps/mobile/lib/api.ts` | API_BASE 指向 Supabase Edge Functions |
| `packages/ai/src/glm/client.ts` | 默认模型改为 glm-4.7-flash |

### 新建的文件
| 文件 | 职责 |
|------|------|
| `apps/mobile/components/chat/VoiceRecordingOverlay.tsx` | 录音浮层（声纹动画 + 上滑取消） |
| `apps/mobile/hooks/useAudioPlayer.ts` | 语音播放 hook（管理播放状态） |
| `supabase/functions/record-asr/index.ts` | ASR Edge Function |
| `supabase/functions/record-ocr/index.ts` | OCR Edge Function |
| `supabase/functions/record-text/index.ts` | 文本记账 Edge Function |
| `supabase/functions/_shared/cors.ts` | Edge Functions 共享 CORS 配置 |

### 移动的文件
| 源 | 目标 |
|------|------|
| `apps/mobile/lib/rule-engine/*` | `packages/shared/src/rule-engine/*` |

---

## Task 1: 数据层 — Schema + 类型 + CRUD

**Files:**
- Modify: `packages/shared/src/types/chat.ts`
- Modify: `apps/mobile/lib/db/schema.ts:94-115`
- Modify: `apps/mobile/hooks/useLocalChatMessages.ts`

- [ ] **Step 1: 更新 ChatMessage 类型**

在 `packages/shared/src/types/chat.ts` 的 `ChatMessage` 接口末尾新增两个字段：

```typescript
export interface ChatMessage {
  readonly id: string;
  readonly user_id: string;
  readonly role: ChatRole;
  readonly content_type: ChatContentType;
  readonly content: string;
  readonly transaction_id: string | null;
  readonly created_at: string;
  readonly audio_uri?: string | null;
  readonly duration_seconds?: number | null;
}
```

- [ ] **Step 2: 新增 Schema 迁移**

在 `apps/mobile/lib/db/schema.ts` 的 `runMigrations` 函数末尾，在唯一索引创建语句之后，新增两行：

```typescript
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // ... 现有迁移代码保持不变 ...

  // 语音消息字段
  await addColumnIfNotExists(db, "chat_messages", "audio_uri", "TEXT");
  await addColumnIfNotExists(db, "chat_messages", "duration_seconds", "INTEGER");
}
```

- [ ] **Step 3: 更新 AddMessageInput 接口和 INSERT 语句**

在 `apps/mobile/hooks/useLocalChatMessages.ts` 中：

1. 更新 `AddMessageInput` 接口：

```typescript
export interface AddMessageInput {
  readonly role: ChatRole;
  readonly content_type: ChatContentType;
  readonly content: string;
  readonly transaction_id?: string | null;
  readonly audio_uri?: string | null;
  readonly duration_seconds?: number | null;
}
```

2. 更新 `useAddChatMessage` 的 INSERT 语句：

```typescript
return useMutation({
  mutationFn: async (input: AddMessageInput): Promise<string> => {
    if (!db) throw new Error("Database not initialized");
    const id = Crypto.randomUUID();
    const now = new Date().toISOString();
    await db.runAsync(
      "INSERT INTO chat_messages (id, user_id, role, content_type, content, transaction_id, created_at, audio_uri, duration_seconds) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)",
      id,
      input.role,
      input.content_type,
      input.content,
      input.transaction_id ?? null,
      now,
      input.audio_uri ?? null,
      input.duration_seconds ?? null
    );
    return id;
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["chat-messages"] });
  },
});
```

- [ ] **Step 4: 提交**

```bash
git add packages/shared/src/types/chat.ts apps/mobile/lib/db/schema.ts apps/mobile/hooks/useLocalChatMessages.ts
git commit -m "feat: chat_messages 表新增 audio_uri 和 duration_seconds 字段"
```

---

## Task 2: useVoiceRecorder — 返回录音时长

**Files:**
- Modify: `apps/mobile/hooks/useVoiceRecorder.ts`

- [ ] **Step 1: 添加录音开始时间戳 ref**

在 `useVoiceRecorder` 函数体中，现有 ref 声明区域（`timerRef`, `cancelledRef` 附近）新增：

```typescript
const startTimeRef = useRef<number>(0);
```

- [ ] **Step 2: 在 startRecording 中记录开始时间**

在 `startRecording` 函数中，`recorder.record()` 调用之前新增一行：

```typescript
startTimeRef.current = Date.now();
```

- [ ] **Step 3: 修改 stopRecording 返回类型**

修改 `stopRecording` 函数，返回 `{ base64: string; durationSeconds: number } | null`：

```typescript
const stopRecording = useCallback(async (): Promise<{ base64: string; durationSeconds: number } | null> => {
  clearTimer();
  if (!isRecordingRef.current) return null;

  const durationSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
  await recorder.stop();
  setRecordingFlag(false);

  if (cancelledRef.current) return null;
  const base64 = await readBase64();
  if (!base64) return null;
  return { base64, durationSeconds };
}, [recorder, clearTimer, setRecordingFlag, readBase64]);
```

- [ ] **Step 4: 提交**

```bash
git add apps/mobile/hooks/useVoiceRecorder.ts
git commit -m "feat: useVoiceRecorder 返回录音时长"
```

---

## Task 3: VoiceRecordingOverlay — 录音浮层组件

**Files:**
- Create: `apps/mobile/components/chat/VoiceRecordingOverlay.tsx`

- [ ] **Step 1: 创建 VoiceRecordingOverlay 组件**

创建 `apps/mobile/components/chat/VoiceRecordingOverlay.tsx`：

```typescript
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
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/components/chat/VoiceRecordingOverlay.tsx
git commit -m "feat: 新增 VoiceRecordingOverlay 录音浮层组件"
```

---

## Task 4: useAudioPlayer — 语音播放 hook

**Files:**
- Create: `apps/mobile/hooks/useAudioPlayer.ts`

- [ ] **Step 1: 创建 useAudioPlayer hook**

创建 `apps/mobile/hooks/useAudioPlayer.ts`：

```typescript
import { useRef, useCallback, useState } from 'react';
import { createAudioPlayer } from 'expo-audio';

export function useAudioPlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.remove();
      playerRef.current = null;
    }
  }, []);

  const play = useCallback((messageId: string, uri: string) => {
    if (playingId === messageId) {
      // 点击正在播放的 → 停止
      cleanup();
      setPlayingId(null);
      return;
    }

    // 停止旧的
    cleanup();

    // 播放新的
    const player = createAudioPlayer({ uri });
    playerRef.current = player;
    player.play();
    setPlayingId(messageId);

    // 播放结束后清除状态
    checkIntervalRef.current = setInterval(() => {
      if (player.currentTime >= player.duration && player.duration > 0) {
        cleanup();
        setPlayingId(null);
      }
    }, 300);
  }, [playingId, cleanup]);

  const stop = useCallback(() => {
    cleanup();
    setPlayingId(null);
  }, [cleanup]);

  return { playingId, play, stop };
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/hooks/useAudioPlayer.ts
git commit -m "feat: 新增 useAudioPlayer 语音播放 hook"
```

---

## Task 5: ChatBubble + VoiceBubble — 显示修复 + 播放

**Files:**
- Modify: `apps/mobile/components/chat/VoiceBubble.tsx`
- Modify: `apps/mobile/components/chat/ChatBubble.tsx`

- [ ] **Step 1: VoiceBubble 新增 status prop**

在 `apps/mobile/components/chat/VoiceBubble.tsx` 中：

1. 更新 `VoiceBubbleProps` 接口，新增 `status`：

```typescript
interface VoiceBubbleProps {
  readonly role: 'user' | 'assistant';
  readonly duration: number;
  readonly isPlaying: boolean;
  readonly onPlay: () => void;
  readonly transcription?: string;
  readonly status?: 'sending' | 'transcribing' | 'done';
}
```

2. 在组件末尾 `transcription` 渲染区域下方，新增 status 文字显示：

```typescript
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
```

- [ ] **Step 2: ChatBubble 传递 audio 相关 props**

在 `apps/mobile/components/chat/ChatBubble.tsx` 中：

1. 更新 `ChatBubbleProps` 接口新增播放相关 props：

```typescript
interface ChatBubbleProps {
  readonly message: ChatMessage;
  readonly status?: 'pending' | 'failed';
  readonly onDelete?: () => void;
  readonly onRetry?: () => void;
  readonly transaction?: Transaction;
  readonly categories?: readonly Category[];
  readonly onEditRecord?: () => void;
  readonly onSuggestion?: (label: string) => void;
  readonly isPlaying?: boolean;
  readonly onPlay?: () => void;
}
```

2. 在函数签名中解构新 props：

```typescript
export function ChatBubble({ message, status, onDelete, onRetry, transaction, categories, onEditRecord, isPlaying, onPlay }: ChatBubbleProps) {
```

3. 修改 `content_type === 'audio'` 的渲染逻辑（约第 61-68 行）：

```typescript
if (content_type === 'audio') {
  return (
    <VoiceBubble
      role="user"
      duration={message.duration_seconds ?? 0}
      isPlaying={isPlaying ?? false}
      onPlay={onPlay ?? (() => {})}
    />
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/components/chat/VoiceBubble.tsx apps/mobile/components/chat/ChatBubble.tsx
git commit -m "fix: VoiceBubble 从 duration_seconds 读取时长，新增播放支持"
```

---

## Task 6: ChatInputBar — 状态提升 + 签名变更

**Files:**
- Modify: `apps/mobile/components/chat/ChatInputBar.tsx`

- [ ] **Step 1: 修改 Props 接口**

将录音状态相关 state 从组件内部提升到 props：

```typescript
type RecordingState = 'idle' | 'recording' | 'cancelling';

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
```

导出 `RecordingState` 类型供 ChatScreen 使用：

```typescript
export type { RecordingState };
```

- [ ] **Step 2: 移除组件内部的录音状态**

移除组件内的 `recordingState`、`recordingSeconds` 的 `useState`，改为从 props 读取。移除 `setRecordingState` 和 `setRecordingSeconds` 的调用，改用 props 中的回调：

```typescript
export function ChatInputBar({
  onSendText, onCamera, onVoice, onQuickAction,
  recordingState, recordingSeconds, onRecordingStateChange, onRecordingSecondsChange,
}: ChatInputBarProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [plusExpanded, setPlusExpanded] = useState(false);

  const hasText = text.trim().length > 0;
  const { startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  const recordingStateRef = useRef<RecordingState>('idle');
  function setRecordingStateSync(s: RecordingState) {
    recordingStateRef.current = s;
    onRecordingStateChange(s);
  }

  const onVoiceRef = useRef(onVoice);
  onVoiceRef.current = onVoice;

  const startYRef = useRef(0);

  // 移除 timerRef 和 wasRecordingRef 以及相关的 useEffect
  // （录音计时器现在由父组件 ChatScreen 管理）
```

- [ ] **Step 3: 更新 PanResponder 的 onPanResponderRelease**

```typescript
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
```

- [ ] **Step 4: 提交**

```bash
git add apps/mobile/components/chat/ChatInputBar.tsx
git commit -m "refactor: ChatInputBar 录音状态提升到 props"
```

---

## Task 7: ChatScreen 集成 — 录音状态 + 播放 + Overlay

> 注意：此 Task 与 Task 8 (useChat.ts) 紧密耦合。Task 8 修改了 `sendAsr` 签名，Task 7 引用新签名。实施时建议先完成 Task 8 再做 Task 7，或两者一起提交。

**Files:**
- Modify: `apps/mobile/app/index.tsx`

- [ ] **Step 1: 新增 imports 和状态**

在 `apps/mobile/app/index.tsx` 顶部新增 import：

```typescript
import { useState, useEffect, useRef } from 'react';
import { VoiceRecordingOverlay } from '../components/chat/VoiceRecordingOverlay';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import type { RecordingState } from '../components/chat/ChatInputBar';
```

在 `ChatScreen` 函数体中新增状态管理：

```typescript
// 录音状态（从 ChatInputBar 提升上来）
const [recordingState, setRecordingState] = useState<RecordingState>('idle');
const [recordingSeconds, setRecordingSeconds] = useState(0);

// 录音计时器
const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
const wasRecordingRef = useRef(false);
useEffect(() => {
  const isActive = recordingState !== 'idle';
  if (isActive && !wasRecordingRef.current) {
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
  } else if (!isActive && wasRecordingRef.current) {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecordingSeconds(0);
  }
  wasRecordingRef.current = isActive;
  return () => { if (timerRef.current) clearInterval(timerRef.current); };
}, [recordingState]);

// 语音播放
const { playingId, play: playAudio } = useAudioPlayer();
```

- [ ] **Step 2: 更新 sendAsr 回调**

修改 `onVoice` 传给 `ChatInputBar` 的回调：

```typescript
onVoice={(base64, durationSeconds) => sendAsr(base64, durationSeconds)}
```

注意：`sendAsr` 的签名变更在 Task 9 中完成。暂时先传递参数，编译警告后续修复。

- [ ] **Step 3: 更新 ChatInputBar 调用**

```typescript
<ChatInputBar
  onSendText={sendText}
  onCamera={async () => {
    const base64 = await pickImage();
    if (base64) sendOcr(base64);
  }}
  onVoice={(base64, durationSeconds) => sendAsr(base64, durationSeconds)}
  onQuickAction={(actionText) => sendText(actionText)}
  recordingState={recordingState}
  recordingSeconds={recordingSeconds}
  onRecordingStateChange={setRecordingState}
  onRecordingSecondsChange={setRecordingSeconds}
/>
```

- [ ] **Step 4: 更新 renderItem 传递播放 props**

在 `renderItem` 函数中，`ChatBubble` 调用新增播放相关 props：

```typescript
<ChatBubble
  message={msg}
  categories={categories}
  onDelete={() => deleteMutation.mutate(msg.id)}
  onEditRecord={msg.content_type === 'bill_card' ? () => {
    try {
      const tx = JSON.parse(msg.content) as Transaction;
      router.push({ pathname: '/manual-entry', params: { txData: JSON.stringify(tx), msgId: msg.id } });
    } catch { /* ignore parse errors */ }
  } : undefined}
  isPlaying={playingId === msg.id}
  onPlay={msg.content_type === 'audio' && msg.audio_uri
    ? () => playAudio(msg.id, msg.audio_uri!)
    : undefined}
/>
```

- [ ] **Step 5: 渲染 VoiceRecordingOverlay**

在 `</View>` 闭合标签前（`bottomPanel` 之后），新增 Overlay：

```typescript
      {/* ── Voice recording overlay ── */}
      <VoiceRecordingOverlay
        visible={recordingState !== 'idle'}
        state={recordingState === 'idle' ? 'recording' : recordingState}
        seconds={recordingSeconds}
      />
    </View>
  );
}
```

- [ ] **Step 6: 提交**

```bash
git add apps/mobile/app/index.tsx
git commit -m "feat: ChatScreen 集成录音浮层和语音播放"
```

---

## Task 8: useChat.ts — 乐观渲染 + 音频保存 + transcription

**Files:**
- Modify: `apps/mobile/hooks/useChat.ts`

- [ ] **Step 1: 修改 sendAsr 签名和实现**

将 `sendAsr` 改为接收 `durationSeconds` 参数，实现乐观渲染和音频保存：

```typescript
const sendAsr = useCallback(async (audioBase64: string, durationSeconds: number) => {
  if (!db) return;

  // 1. 保存音频文件到本地
  let audioUri: string | null = null;
  try {
    const dir = `${FileSystem.documentDirectory}voice-messages/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    audioUri = `${dir}${Date.now()}-${Crypto.randomUUID()}.m4a`;
    await FileSystem.writeAsStringAsync(audioUri, audioBase64, { encoding: FileSystem.EncodingType.Base64 });
  } catch (err) {
    console.error('[sendAsr] 音频保存失败:', err);
  }

  // 2. 乐观渲染：立即显示语音气泡
  const msgId = await addMessage({
    role: "user",
    content_type: "audio",
    content: "[语音]",
    audio_uri: audioUri,
    duration_seconds: durationSeconds,
  });

  // 3. 检查网络
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    await addMessage({
      role: "assistant",
      content_type: "text",
      content: "未联网，无法使用语音服务。",
    });
    return;
  }

  // 4. 调用 ASR API
  setLoading(true);
  try {
    const resp = await apiFetch<any>("/record-asr", {
      method: "POST",
      body: JSON.stringify({ audioBase64 }),
    });

    // 5. 更新语音消息的 transcription
    if (resp.data?.asrText) {
      await db.runAsync(
        "UPDATE chat_messages SET content = ? WHERE id = ?",
        resp.data.asrText,
        msgId,
      );
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
    }

    // 6. 处理响应
    if (resp.data?.type === "bill") {
      const tx = resp.data.transaction;
      await addMessage({
        role: "assistant",
        content_type: "bill_card",
        content: JSON.stringify(tx),
        transaction_id: tx.id,
      });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    } else {
      await addMessage({
        role: "assistant",
        content_type: "text",
        content: resp.data?.message ?? "没听清，要不再说一次？",
      });
    }
  } catch {
    await addMessage({
      role: "assistant",
      content_type: "text",
      content: "网络错误，语音识别失败。",
    });
  } finally {
    setLoading(false);
  }
}, [db, qc, addMessage]);
```

- [ ] **Step 2: 更新 sendOcr 和 sendText 的 API 路径**

将现有的 API 路径从 `/api/record/xxx` 改为 `/record-xxx`（匹配 Edge Function 路径）：

- `sendOcr` 中：`"/api/record/ocr"` → `"/record-ocr"`
- `sendText` 中：`"/api/record/text"` → `"/record-text"`

- [ ] **Step 3: 更新 return**

```typescript
return { sendText, sendOcr, sendAsr, isLoading };
```

- [ ] **Step 4: 提交**

```bash
git add apps/mobile/hooks/useChat.ts
git commit -m "feat: sendAsr 乐观渲染 + 本地保存音频文件"
```

---

## Task 9: 移动 rule-engine 到 shared 包

**Files:**
- Move: `apps/mobile/lib/rule-engine/*` → `packages/shared/src/rule-engine/*`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/mobile/hooks/useChat.ts` (import path)

- [ ] **Step 1: 移动 rule-engine 文件**

```bash
cp -r apps/mobile/lib/rule-engine packages/shared/src/rule-engine
```

- [ ] **Step 2: 更新 shared 包导出**

在 `packages/shared/src/index.ts` 末尾新增：

```typescript
export { parse, type ParseResult } from "./rule-engine/index";
```

- [ ] **Step 3: 更新移动端导入路径**

在 `apps/mobile/hooks/useChat.ts` 中，将：

```typescript
import { parse } from "@/lib/rule-engine";
```

改为：

```typescript
import { parse } from "@coco/shared";
```

- [ ] **Step 4: 删除旧的 rule-engine 目录**

```bash
rm -rf apps/mobile/lib/rule-engine
```

- [ ] **Step 5: 运行 lint 验证**

```bash
cd packages/shared && pnpm lint
```

预期：无类型错误。

- [ ] **Step 6: 提交**

```bash
git add packages/shared/src/rule-engine packages/shared/src/index.ts apps/mobile/hooks/useChat.ts
git add -u apps/mobile/lib/rule-engine
git commit -m "refactor: rule-engine 移至 @coco/shared 实现跨端复用"
```

---

## Task 10: API 层 + GLM 模型升级

**Files:**
- Modify: `apps/mobile/lib/api.ts`
- Modify: `packages/ai/src/glm/client.ts`

- [ ] **Step 1: 更新 API_BASE**

在 `apps/mobile/lib/api.ts` 中，将：

```typescript
const API_BASE = process.env.EXPO_PUBLIC_API_URL!;
```

改为：

```typescript
const API_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL! + "/functions/v1";
```

- [ ] **Step 2: GLM 默认模型升级**

在 `packages/ai/src/glm/client.ts` 中，将：

```typescript
const { apiKey, model = "glm-4-flash", timeoutMs = 8000 } = options;
```

改为：

```typescript
const { apiKey, model = "glm-4.7-flash", timeoutMs = 8000 } = options;
```

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/lib/api.ts packages/ai/src/glm/client.ts
git commit -m "feat: API_BASE 指向 Supabase Edge Functions；GLM 升级到 4.7-flash"
```

---

## Task 11: Edge Function 共享工具 + record-asr

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/record-asr/index.ts`

- [ ] **Step 1: 创建 CORS 共享模块**

创建 `supabase/functions/_shared/cors.ts`：

```typescript
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-timezone",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
```

- [ ] **Step 2: 创建 record-asr Edge Function**

创建 `supabase/functions/record-asr/index.ts`：

```typescript
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const TENCENT_SECRET_ID = Deno.env.get("TENCENT_SECRET_ID")!;
const TENCENT_SECRET_KEY = Deno.env.get("TENCENT_SECRET_KEY")!;
const GLM_API_KEY = Deno.env.get("GLM_API_KEY")!;

// ─── 腾讯云 ASR ───
async function recognizeSpeech(audioBase64: string): Promise<string> {
  const tencentcloud = await import("npm:tencentcloud-sdk-nodejs@4");
  const AsrClient = tencentcloud.asr.v20190614.Client;
  const client = new AsrClient({
    credential: { secretId: TENCENT_SECRET_ID, secretKey: TENCENT_SECRET_KEY },
    region: "ap-guangzhou",
  });
  const resp = await client.SentenceRecognition({
    EngSerViceType: "16k_zh",
    SourceType: 1,
    VoiceFormat: "wav",
    Data: audioBase64,
    DataLen: new Uint8Array(atob(audioBase64).split("").map((c) => c.charCodeAt(0))).length,
  });
  return resp.Result ?? "";
}

// ─── GLM 调用 ───
async function callGlm(prompt: string): Promise<string> {
  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GLM_API_KEY}` },
    body: JSON.stringify({ model: "glm-4.7-flash", messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) throw new Error(`GLM API error: ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── rule-engine（轻量内联版） ───
function parseAmount(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d{1,2})?)/);
  return m ? parseFloat(m[1]) : null;
}

// ─── 记账 JSON 提取 prompt ───
function buildExtractPrompt(asrText: string): string {
  const now = new Date().toISOString();
  return `从以下语音转文字内容中提取记账信息，返回 JSON 格式：
{"amount": number, "category": string, "note": string, "occurred_at": string, "type": "expense"|"income"}

规则：
- amount: 金额数值
- category: 从以下分类中选择最匹配的：餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
- note: 简短描述
- type: "income" 如果是收入（工资、理财等），否则 "expense"
- occurred_at: ISO 8601 格式，相对日期请基于当前时间计算

当前时间：${now}
只返回 JSON，不要其他文字。

语音内容：${asrText}`;
}

function extractJson(raw: string): Record<string, unknown> | null {
  try {
    const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : raw.match(/\{[\s\S]*\}/)?.[0] ?? raw.trim();
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// ─── Handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 验证 JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { audioBase64 } = await req.json();
    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "Missing audioBase64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. ASR
    const asrText = await recognizeSpeech(audioBase64);
    if (!asrText.trim()) {
      return new Response(JSON.stringify({ data: { type: "text", message: "没听清，要不再说一次？", asrText: "" } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. 尝试简单金额提取（rule-engine 轻量版）
    const simpleAmount = parseAmount(asrText);

    // 3. GLM 提取完整记账信息
    const glmRaw = await callGlm(buildExtractPrompt(asrText));
    const parsed = extractJson(glmRaw);

    if (parsed && typeof parsed.amount === "number" && parsed.amount > 0) {
      return new Response(JSON.stringify({
        data: {
          type: "bill",
          asrText,
          transaction: {
            amount: parsed.amount,
            category: parsed.category ?? "其他支出",
            note: parsed.note ?? "",
            type: parsed.type === "income" ? "income" : "expense",
            occurred_at: parsed.occurred_at ?? new Date().toISOString(),
          },
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      data: { type: "text", message: `识别到："${asrText}"，但无法提取记账信息。请再试一次。`, asrText },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("record-asr error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 3: 提交**

```bash
git add supabase/functions/_shared/cors.ts supabase/functions/record-asr/index.ts
git commit -m "feat: record-asr Edge Function（腾讯云 ASR + GLM 提取）"
```

---

## Task 12: Edge Function — record-ocr

**Files:**
- Create: `supabase/functions/record-ocr/index.ts`

- [ ] **Step 1: 创建 record-ocr Edge Function**

创建 `supabase/functions/record-ocr/index.ts`：

```typescript
import { corsHeaders } from "../_shared/cors.ts";

const TENCENT_SECRET_ID = Deno.env.get("TENCENT_SECRET_ID")!;
const TENCENT_SECRET_KEY = Deno.env.get("TENCENT_SECRET_KEY")!;
const GLM_API_KEY = Deno.env.get("GLM_API_KEY")!;

// ─── 腾讯云 OCR ───
async function recognizeReceipt(imageBase64: string): Promise<string> {
  const tencentcloud = await import("npm:tencentcloud-sdk-nodejs@4");
  const OcrClient = tencentcloud.ocr.v20181119.Client;
  const client = new OcrClient({
    credential: { secretId: TENCENT_SECRET_ID, secretKey: TENCENT_SECRET_KEY },
    region: "ap-guangzhou",
  });
  const resp = await client.GeneralBasicOCR({ ImageBase64: imageBase64 });
  return (resp.TextDetections ?? []).map((det: any) => det.DetectedText ?? "").join("\n");
}

// ─── GLM 调用 ───
async function callGlm(prompt: string): Promise<string> {
  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GLM_API_KEY}` },
    body: JSON.stringify({ model: "glm-4.7-flash", messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) throw new Error(`GLM API error: ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

function buildExtractPrompt(ocrText: string): string {
  return `从以下 OCR 文本中提取记账信息，返回 JSON 格式：
{"amount": number, "category": string, "note": string, "occurred_at": string, "type": "expense"|"income"}

规则：
- amount: 金额数值，不含货币符号
- category: 从以下分类中选择最匹配的：餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
- note: 简短描述（如商户名称+商品）
- type: "income" 如果是收入，否则 "expense"
- occurred_at: ISO 8601 格式日期，无法识别则返回 null

只返回 JSON，不要其他文字。

OCR文本：${ocrText}`;
}

function extractJson(raw: string): Record<string, unknown> | null {
  try {
    const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : raw.match(/\{[\s\S]*\}/)?.[0] ?? raw.trim();
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Missing imageBase64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. OCR
    const ocrText = await recognizeReceipt(imageBase64);
    if (!ocrText.trim()) {
      return new Response(JSON.stringify({ data: { type: "text", message: "无法识别小票内容，请确保图片清晰后重试。" } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. GLM 提取
    const glmRaw = await callGlm(buildExtractPrompt(ocrText));
    const parsed = extractJson(glmRaw);

    if (parsed && typeof parsed.amount === "number" && parsed.amount > 0) {
      return new Response(JSON.stringify({
        data: {
          type: "bill",
          transaction: {
            amount: parsed.amount,
            category: parsed.category ?? "其他支出",
            note: parsed.note ?? "",
            type: parsed.type === "income" ? "income" : "expense",
            occurred_at: parsed.occurred_at ?? new Date().toISOString(),
          },
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      data: { type: "text", message: "小票识别失败，请手动记账。" },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("record-ocr error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: 提交**

```bash
git add supabase/functions/record-ocr/index.ts
git commit -m "feat: record-ocr Edge Function（腾讯云 OCR + GLM 提取）"
```

---

## Task 13: Edge Function — record-text

**Files:**
- Create: `supabase/functions/record-text/index.ts`

- [ ] **Step 1: 创建 record-text Edge Function**

创建 `supabase/functions/record-text/index.ts`：

```typescript
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GLM_API_KEY = Deno.env.get("GLM_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callGlm(prompt: string): Promise<string> {
  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GLM_API_KEY}` },
    body: JSON.stringify({ model: "glm-4.7-flash", messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) throw new Error(`GLM API error: ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

function extractJson(raw: string): Record<string, unknown> | null {
  try {
    const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : raw.match(/\{[\s\S]*\}/)?.[0] ?? raw.trim();
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function buildIntentPrompt(text: string): string {
  return `判断以下用户输入的意图，返回 JSON：{"intent": "record"} 或 {"intent": "query"}。
- record：用户在描述一笔消费或收入（如"午饭35"、"打车花了20"、"收到工资5000"）
- query：用户在查询历史数据（如"上周花了多少"、"本月餐饮支出"）

只返回 JSON，不要其他文字。

用户输入：${text}`;
}

function buildRecordPrompt(text: string): string {
  const now = new Date().toISOString();
  return `从以下文字中提取记账信息，返回 JSON 格式：
{"amount": number, "category": string, "note": string, "occurred_at": string, "type": "expense"|"income"}

规则：
- amount: 金额数值
- category: 从以下分类中选择最匹配的：餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
- note: 简短描述
- type: "income" 如果是收入，否则 "expense"
- occurred_at: ISO 8601 格式，相对日期请基于当前时间计算

当前时间：${now}
只返回 JSON，不要其他文字。

文字内容：${text}`;
}

function buildQueryPrompt(question: string): string {
  const now = new Date().toISOString();
  return `将以下自然语言问题转换为 PostgreSQL SELECT 查询。

可用表结构：
- transactions (id, user_id, category_id, amount, type, note, occurred_at, source, created_at, deleted_at)
  - type: 'income' | 'expense'
  - deleted_at IS NULL 表示未删除
- categories (id, user_id, name, icon, type, is_default)

规则：
- 只生成 SELECT 语句
- 必须包含 WHERE deleted_at IS NULL
- 不要包含 user_id 条件（服务端自动注入）
- 使用 JOIN categories ON transactions.category_id = categories.id 来按分类名过滤
- 当前时间：${now}

只返回 SQL，不要其他文字。

问题：${question}`;
}

function buildSummarizePrompt(question: string, queryResult: string): string {
  return `用户问："${question}"

查询结果如下：
${queryResult}

请用简洁的中文自然语言回答用户的问题。如果结果为空，说"没有找到相关记录"。
包含具体数字和关键细节。`;
}

function extractSql(raw: string): string {
  const codeBlockMatch = raw.match(/```(?:sql)?\s*\n?([\s\S]*?)\n?```/);
  return codeBlockMatch ? codeBlockMatch[1].trim() : raw.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text } = await req.json();
    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. 意图分类
    const intentRaw = await callGlm(buildIntentPrompt(text));
    const intentParsed = extractJson(intentRaw);
    const intent = intentParsed?.intent === "query" ? "query" : "record";

    if (intent === "record") {
      // 2a. 记账
      const glmRaw = await callGlm(buildRecordPrompt(text));
      const parsed = extractJson(glmRaw);

      if (parsed && typeof parsed.amount === "number" && parsed.amount > 0) {
        return new Response(JSON.stringify({
          data: {
            type: "bill",
            transaction: {
              amount: parsed.amount,
              category: parsed.category ?? "其他支出",
              note: parsed.note ?? "",
              type: parsed.type === "income" ? "income" : "expense",
              occurred_at: parsed.occurred_at ?? new Date().toISOString(),
            },
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        data: { type: "text", message: "没有识别到记账信息，请再描述一下。" },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2b. 查询
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 获取用户信息（通过 JWT）
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sqlRaw = await callGlm(buildQueryPrompt(text));
    let sql = extractSql(sqlRaw);

    // 安全性：注入 user_id 条件
    sql = sql.replace(
      /WHERE\s+/i,
      `WHERE transactions.user_id = '${user.id}' AND `,
    );

    const { data: queryResult, error: queryError } = await supabase.rpc("exec_readonly_sql", { sql_text: sql });

    if (queryError) {
      return new Response(JSON.stringify({
        data: { type: "text", message: "查询出错，请换个方式描述。" },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summaryRaw = await callGlm(buildSummarizePrompt(text, JSON.stringify(queryResult)));

    return new Response(JSON.stringify({
      data: { type: "nl_result", message: summaryRaw },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("record-text error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

注意：`record-text` 的查询功能依赖 Supabase 数据库中有一个 `exec_readonly_sql` RPC 函数。如果不存在需要先创建，或者暂时跳过查询功能只保留记账。

- [ ] **Step 2: 提交**

```bash
git add supabase/functions/record-text/index.ts
git commit -m "feat: record-text Edge Function（意图分类 + 记账/查询）"
```

---

## Task 14: 环境变量 + 部署验证

**Files:**
- Modify: `apps/mobile/.env.example`（如果存在）

- [ ] **Step 1: 配置 Supabase Secrets**

```bash
supabase secrets set TENCENT_SECRET_ID=<your-id>
supabase secrets set TENCENT_SECRET_KEY=<your-key>
supabase secrets set GLM_API_KEY=<your-key>
```

- [ ] **Step 2: 部署 Edge Functions**

```bash
supabase functions deploy record-asr
supabase functions deploy record-ocr
supabase functions deploy record-text
```

- [ ] **Step 3: 验证部署**

```bash
supabase functions list
```

预期：三个函数都显示为 Active。

- [ ] **Step 4: 确认前端 EXPO_PUBLIC_SUPABASE_URL 已设置**

检查 `.env` 文件中 `EXPO_PUBLIC_SUPABASE_URL` 是否正确指向你的 Supabase 项目 URL（如 `https://xxx.supabase.co`）。

- [ ] **Step 5: 提交环境变量文档更新（如有）**

```bash
git add -A && git commit -m "chore: 更新环境变量配置"
```

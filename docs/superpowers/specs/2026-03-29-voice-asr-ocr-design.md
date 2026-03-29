# AI 页语音/ASR/OCR 功能设计

## 概述

完善 AI 记账页面的语音和拍照功能：修复录音 0 秒 Bug、实现语音播放、新增微信风格录音浮层、通过 Supabase Edge Functions 补齐缺失的 ASR/OCR/文本记账后端、升级 GLM 模型到 4.7-flash。

## 优先级排序

1. **P0** 录音修复（0 秒 + 无法播放）
2. **P0** 录音浮层交互（声纹 UI）
3. **P1** Supabase Edge Functions（ASR/OCR/Text）
4. **P1** 语音记账端到端流程
5. **P1** OCR 拍照记账修复

---

## 1. 数据层变更

### 1.1 Schema 迁移

`chat_messages` 表新增两列：

```sql
ALTER TABLE chat_messages ADD COLUMN audio_uri TEXT;
ALTER TABLE chat_messages ADD COLUMN duration_seconds INTEGER;
```

- `audio_uri`：本地音频文件路径（`documentDirectory/voice-messages/xxx.m4a`）
- `duration_seconds`：录音时长（秒），整数
- 迁移方式：沿用现有的 `PRAGMA table_info` 检测列是否存在后再 ALTER

### 1.2 类型定义

`packages/shared/src/types/chat.ts` 中 `ChatMessage` 新增：

```typescript
readonly audio_uri?: string | null;
readonly duration_seconds?: number | null;
```

### 1.3 消息 CRUD

`useLocalChatMessages.ts` 的 `useAddChatMessage` 支持新字段：
- INSERT 语句新增 `audio_uri`、`duration_seconds`
- SELECT 查询新增这两个字段的读取

---

## 2. 录音修复

### 2.1 根因

- `useChat.ts` 第 159 行：`content: "[语音]"` — 存的是文字而不是时长
- `ChatBubble.tsx` 第 65 行：`parseInt("[语音]", 10)` → NaN → 显示 0 秒
- 音频 base64 发给 ASR 后丢弃，本地没有保存音频文件

### 2.2 修复方案

**useVoiceRecorder.ts：**
- `stopRecording()` 返回值从 `string | null` 改为 `{ base64: string; durationSeconds: number } | null`
- `durationSeconds` 从录音开始到结束的实际耗时计算

**ChatInputBar.tsx：**
- `onVoice` 签名改为 `(base64: string, durationSeconds: number) => void`
- 录音完成时传递时长

**useChat.ts sendAsr：**
1. 保存音频文件：`base64 → FileSystem.writeAsStringAsync(voice-messages/uuid.m4a)`
2. 乐观渲染：`addMessage({ content_type: "audio", content: "[语音]", audio_uri, duration_seconds })`
3. VoiceBubble 立即可见、可点击播放

**ChatBubble.tsx：**
- `duration` 改为从 `message.duration_seconds` 读取，不再 `parseInt(content)`

### 2.3 播放实现

- 用 `expo-audio` 的 `useAudioPlayer` 加载 `audio_uri` 播放
- 播放状态管理在 `index.tsx`（ChatScreen）层级
- 维护 `playingMessageId`，同一时间只能播放一条语音
- 点击正在播放的语音 → 停止；点击另一条 → 切换

---

## 3. 录音浮层交互

### 3.1 组件

新建 `VoiceRecordingOverlay.tsx`：

```
Props:
- visible: boolean
- state: 'recording' | 'cancelling'
- seconds: number
```

### 3.2 布局

```
┌─────────────────────────────┐
│     半透明遮罩                │
│     rgba(58,48,40,0.5)       │
│                              │
│    ┌──────────────────┐      │
│    │  深色圆角卡片       │      │
│    │  rgba(58,48,40,0.85)│     │
│    │  borderRadius: 18  │     │
│    │                    │     │
│    │   |||||||          │  ← sage 色声纹条（7根）
│    │                    │     │
│    │     3"             │  ← 计时
│    │                    │     │
│    │  ↑ 上滑取消         │  ← recording 态
│    │  松开取消 ❌        │  ← cancelling 态（coral 色）
│    └──────────────────┘      │
│                              │
└─────────────────────────────┘
```

### 3.3 声纹动画

- 7 根竖条，宽度 4px，间距 4px
- react-native-reanimated `withRepeat` + `withTiming`
- 每根条独立随机周期（300-700ms），高度在 10-50px 间波动
- recording 态：sage 色（`#7ba68a`）
- cancelling 态：coral 色（`#e8856c`），缩小到最低高度

### 3.4 状态切换动画

- 弹入：`withSpring` 从底部弹出
- 弹出：`withTiming` 淡出（200ms）
- 颜色切换：声纹条颜色渐变

### 3.5 手势逻辑

- 沿用 ChatInputBar 现有 PanResponder（已实现上滑取消）
- `recordingState` 提升到 ChatScreen 层级
- ChatInputBar 和 VoiceRecordingOverlay 共享同一 state

---

## 4. Supabase Edge Functions

### 4.1 函数清单

| 函数名 | 端点 | 功能 |
|--------|------|------|
| `record-asr` | `POST /functions/v1/record-asr` | 音频 → ASR → rule-engine → GLM |
| `record-ocr` | `POST /functions/v1/record-ocr` | 图片 → OCR → GLM 提取 |
| `record-text` | `POST /functions/v1/record-text` | 文本 → 意图分类 → 记账/查询 |

### 4.2 统一响应格式

```typescript
// 记账成功
{ type: "bill", transaction: { amount, category_id, type, note, occurred_at } }

// 查询结果
{ type: "nl_result", message: "本周共消费 320 元..." }

// 纯文字
{ type: "text", message: "没听清，要不再说一次？" }
```

与现有 `useChat.ts` 响应解析逻辑兼容。

### 4.3 record-asr 流程

```
请求: { audioBase64: string }
  ├─ 1. 验证 JWT（Supabase auth）
  ├─ 2. 腾讯云 ASR: recognizeSpeech(audioBase64) → 文字
  ├─ 3. rule-engine: parse(asrText)
  │     ├─ 命中 → 返回 { type: "bill", ... }
  │     └─ 未命中 ↓
  ├─ 4. GLM-4.7-Flash: callGlm(buildAsrExtractPrompt(asrText))
  └─ 5. 返回结果
```

### 4.4 record-ocr 流程

```
请求: { imageBase64: string }
  ├─ 1. 验证 JWT
  ├─ 2. 腾讯云 OCR: recognizeReceipt(imageBase64) → 文字
  ├─ 3. GLM-4.7-Flash: callGlm(buildOcrExtractPrompt(ocrText))
  └─ 4. 返回结果
```

### 4.5 record-text 流程

```
请求: { text: string }
  ├─ 1. 验证 JWT
  ├─ 2. GLM 意图分类: callGlm(buildIntentClassifyPrompt(text))
  │     ├─ intent=record → callGlm(buildAsrExtractPrompt(text)) → bill
  │     └─ intent=query → callGlm(buildText2SqlPrompt(text)) → 执行 SQL → 总结
  └─ 3. 返回结果
```

### 4.6 Deno 兼容性

Edge Functions 运行在 Deno 环境：
- `tencentcloud-sdk-nodejs`（ASR/OCR）：通过 `npm:tencentcloud-sdk-nodejs` 导入，Deno 原生支持 npm 包
- `callGlm`（GLM）：使用标准 `fetch`，Deno 原生支持，无需改动
- `rule-engine`：纯 TypeScript 函数，无环境依赖，直接导入

### 4.7 密钥管理

```bash
supabase secrets set TENCENT_SECRET_ID=xxx
supabase secrets set TENCENT_SECRET_KEY=xxx
supabase secrets set GLM_API_KEY=xxx
```

Edge Function 内通过 `Deno.env.get()` 读取。

### 4.8 前端改动

`apps/mobile/lib/api.ts`：

```typescript
const API_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL + "/functions/v1";
```

路径映射：
- `/api/record/asr` → `/functions/v1/record-asr`
- `/api/record/ocr` → `/functions/v1/record-ocr`
- `/api/record/text` → `/functions/v1/record-text`

### 4.9 rule-engine 跨端复用

将 `apps/mobile/lib/rule-engine/` 移动到 `packages/shared/src/rule-engine/`：
- 纯函数，无 React Native 依赖，适合跨端
- Edge Function 和移动端均从 `@coco/shared` 导入
- 移动端导入路径 `@/lib/rule-engine` → `@coco/shared/rule-engine`

---

## 5. GLM 模型升级

`packages/ai/src/glm/client.ts` 默认模型从 `glm-4-flash` 改为 `glm-4.7-flash`。

---

## 6. 端到端流程

### 6.1 语音记账

```
按住录音 → VoiceRecordingOverlay 弹出（声纹动画）
  → 松手 → stopRecording() → { base64, durationSeconds }
  → 保存 .m4a 到本地
  → addMessage(audio, uri, duration) → VoiceBubble 立即显示 ← 乐观渲染
  → 检查网络
    ├─ 离线 → "未联网，无法使用语音服务"
    └─ 在线 → Edge Function record-asr
      → ASR 文字 → rule-engine
        ├─ 命中 → bill_card
        └─ 未命中 → GLM → bill_card 或 text
  → 更新语音消息 transcription
  → invalidateQueries
```

### 6.2 OCR 拍照记账

```
点击 📷 → 拍照 → imageBase64
  → 保存图片到本地（现有逻辑）
  → addMessage(image) → OcrBubble 显示
  → Edge Function record-ocr
    → OCR 文字 → GLM → bill_card 或 text
  → invalidateQueries
```

---

## 7. 修改文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `apps/mobile/lib/db/schema.ts` | 修改 | ALTER 新增 audio_uri、duration_seconds |
| `packages/shared/src/types/chat.ts` | 修改 | ChatMessage 新增字段 |
| `apps/mobile/hooks/useLocalChatMessages.ts` | 修改 | INSERT/SELECT 支持新字段 |
| `apps/mobile/hooks/useVoiceRecorder.ts` | 修改 | 返回 { base64, durationSeconds } |
| `apps/mobile/hooks/useChat.ts` | 修改 | sendAsr 乐观渲染+保存音频+transcription；sendOcr 改 API 路径 |
| `apps/mobile/components/chat/ChatInputBar.tsx` | 修改 | recordingState 提升；onVoice 签名变更 |
| `apps/mobile/components/chat/ChatBubble.tsx` | 修改 | duration 从 duration_seconds 读取 |
| `apps/mobile/components/chat/VoiceBubble.tsx` | 修改 | 新增 status prop、播放功能 |
| `apps/mobile/app/index.tsx` | 修改 | 管理 recordingState/playingMessageId；渲染 Overlay |
| `apps/mobile/lib/api.ts` | 修改 | API_BASE 指向 Supabase Edge Functions |
| `packages/ai/src/glm/client.ts` | 修改 | 默认模型改为 glm-4.7-flash |
| `apps/mobile/components/chat/VoiceRecordingOverlay.tsx` | **新建** | 录音浮层组件 |
| `supabase/functions/record-asr/index.ts` | **新建** | ASR Edge Function |
| `supabase/functions/record-ocr/index.ts` | **新建** | OCR Edge Function |
| `supabase/functions/record-text/index.ts` | **新建** | 文本记账 Edge Function |
| `apps/mobile/lib/rule-engine/` | **移动** | → packages/shared/src/rule-engine/ |

# AI 页面性能优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除 AI 聊天页进入时的卡顿（冻住/白屏），通过图片缓存、FlatList 渲染优化、数据层优化三层改动实现。

**Architecture:** 在当前 Stack 路由架构不变的前提下，从渲染层（expo-image 缓存 + React.memo + useMemo/useCallback）和数据层（SQLite 索引 + 合并 invalidateQueries）两个维度优化。所有改动都是前端本地逻辑，不涉及 Supabase 或后端。

**Tech Stack:** React Native (Expo SDK 55), expo-image, React Query, expo-sqlite

---

## 文件结构

| 文件 | 操作 | 职责变更 |
|------|------|---------|
| `apps/mobile/components/ui/ImagePreview.tsx` | 修改 | RN Image → expo-image Image |
| `apps/mobile/app/index.tsx` | 修改 | buildListItems 加 useMemo, renderItem 加 useCallback, 回调稳定化 |
| `apps/mobile/components/chat/ChatBubble.tsx` | 修改 | 加 React.memo, props 接口改为接收 id + 稳定回调 |
| `apps/mobile/lib/db/schema.ts` | 修改 | runMigrations 加 chat_messages.created_at 索引 |
| `apps/mobile/hooks/useLocalChatMessages.ts` | 修改 | useAddChatMessage 支持 skipInvalidate |
| `apps/mobile/hooks/useChat.ts` | 修改 | 流程末尾统一 invalidate，中间步骤跳过 |

---

### Task 1: 安装 expo-image

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: 安装 expo-image**

```bash
cd apps/mobile && npx expo install expo-image
```

- [ ] **Step 2: 验证安装成功**

```bash
grep '"expo-image"' apps/mobile/package.json
```

Expected: 出现 `"expo-image": "~x.x.x"` 依赖行

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/package.json apps/mobile/pnpm-lock.yaml
git commit -m "chore: install expo-image for cached image rendering"
```

---

### Task 2: ImagePreview 换用 expo-image

**Files:**
- Modify: `apps/mobile/components/ui/ImagePreview.tsx`

- [ ] **Step 1: 替换 ImagePreview 组件**

将 `apps/mobile/components/ui/ImagePreview.tsx` 完整替换为：

```tsx
import { Image } from 'expo-image';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';

interface ImagePreviewProps {
  readonly uri: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function ImagePreview({ uri, style }: ImagePreviewProps) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/image-viewer', params: { uri } })}
      style={style}
    >
      <Image source={uri} style={styles.thumbnail} contentFit="cover" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: '100%',
    height: '100%',
  },
});
```

关键变更：
- `import { Image } from 'react-native'` → `import { Image } from 'expo-image'`
- `source={{ uri }}` → `source={uri}`（expo-image 的 string 快捷写法）
- `resizeMode="cover"` → `contentFit="cover"`（expo-image API）

- [ ] **Step 2: 验证编译无错**

```bash
cd apps/mobile && npx expo start --clear
```

打开 AI 页，确认 OCR 图片正常显示、点击可进入大图查看。

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/components/ui/ImagePreview.tsx
git commit -m "perf: replace RN Image with expo-image for cached decoding"
```

---

### Task 3: ChatBubble 加 React.memo + 稳定化 props 接口

**Files:**
- Modify: `apps/mobile/components/chat/ChatBubble.tsx`

- [ ] **Step 1: 修改 ChatBubble props 接口和导出**

将 `apps/mobile/components/chat/ChatBubble.tsx` 做以下修改：

**1a. 在文件顶部添加 React 导入：**

```tsx
import React from 'react';
```

**1b. 修改 ChatBubbleProps 接口** — 将 `onDelete` 从无参回调改为接收 messageId 的回调，减少父组件创建闭包：

```tsx
interface ChatBubbleProps {
  readonly message: ChatMessage;
  readonly status?: 'pending' | 'failed';
  readonly onDelete?: (messageId: string) => void;
  readonly onRetry?: () => void;
  readonly transaction?: Transaction;
  readonly categories?: readonly Category[];
  readonly onEditRecord?: (messageId: string) => void;
  readonly onSuggestion?: (label: string) => void;
  readonly isPlaying?: boolean;
  readonly onPlay?: () => void;
  readonly onResendOcr?: (messageId: string) => void;
}
```

**1c. 更新组件内调用处**，让 ChatBubble 自己传 id：

`handleLongPress` 调用处改为：
```tsx
onLongPress={() => handleLongPress(message.id, onDelete)}
```

`handleLongPress` 函数签名改为：
```tsx
function handleLongPress(messageId: string, onDelete?: (id: string) => void) {
  if (!onDelete) return;
  Alert.alert("消息操作", "", [
    { text: "删除", style: "destructive", onPress: () => onDelete(messageId) },
    { text: "取消", style: "cancel" },
  ]);
}
```

`onResendOcr` 调用处改为：
```tsx
{content_type === 'image' && onResendOcr && (
  <TouchableOpacity onPress={() => onResendOcr(message.id)} style={styles.resendOcrBtn} activeOpacity={0.7}>
    <AppText size="sm" color={colors.white}>↩ 重新识别</AppText>
  </TouchableOpacity>
)}
```

`onEditRecord` 调用处（bill_card 区块内的 RecordCard）改为：
```tsx
<RecordCard
  transaction={parsedTransaction}
  categoryName={matchedCategory?.name}
  categoryIcon={matchedCategory?.icon}
  onEdit={onEditRecord ? () => onEditRecord(message.id) : undefined}
  onDelete={onDelete ? () => onDelete(message.id) : undefined}
/>
```

**1d. 将导出包裹 React.memo：**

把：
```tsx
export function ChatBubble({ message, status, onDelete, onRetry, transaction, categories, onEditRecord, isPlaying, onPlay, onResendOcr }: ChatBubbleProps) {
```

改为：
```tsx
export const ChatBubble = React.memo(function ChatBubble({ message, status, onDelete, onRetry, transaction, categories, onEditRecord, isPlaying, onPlay, onResendOcr }: ChatBubbleProps) {
```

并在文件最末尾（`styles` 之后）加上闭合括号：
```tsx
});  // 闭合 React.memo
```

注意：需要把原来函数体最后的 `}` 改为 `});`。

- [ ] **Step 2: 验证编译无错**

```bash
cd apps/mobile && npx expo start --clear
```

打开 AI 页，确认所有气泡类型（文字、图片、语音、账单卡片）正常显示。长按删除、点击编辑、重新识别按钮都正常工作。

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/components/chat/ChatBubble.tsx
git commit -m "perf: wrap ChatBubble with React.memo, stabilize callback props"
```

---

### Task 4: index.tsx FlatList 渲染优化

**Files:**
- Modify: `apps/mobile/app/index.tsx`

- [ ] **Step 1: 添加 useMemo/useCallback 导入**

将第 4 行：
```tsx
import { useEffect, useState } from "react";
```
改为：
```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
```

- [ ] **Step 2: buildListItems 包裹 useMemo**

将第 220-225 行：
```tsx
  const listItems = buildListItems(messages, isSending);

  // Show welcome message only when no messages exist
  if (messages.length === 0) {
    listItems.push({ type: "message", data: WELCOME_MESSAGE });
  }
```

替换为：
```tsx
  const listItems = useMemo(() => {
    const items = buildListItems(messages, isSending);
    if (messages.length === 0) {
      items.push({ type: "message", data: WELCOME_MESSAGE });
    }
    return items;
  }, [messages, isSending]);
```

- [ ] **Step 3: 创建稳定的回调函数**

在 `const listItems = useMemo(...)` 之前，添加以下稳定回调：

```tsx
  const handleDelete = useCallback(
    (messageId: string) => deleteMutation.mutate(messageId),
    [deleteMutation],
  );

  const handleEditRecord = useCallback(
    (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || msg.content_type !== "bill_card") return;
      try {
        const tx = JSON.parse(msg.content) as Transaction;
        router.push({
          pathname: "/manual-entry",
          params: { txData: JSON.stringify(tx), msgId: msg.id },
        });
      } catch {
        /* ignore parse errors */
      }
    },
    [messages],
  );

  const handleResendOcr = useCallback(
    async (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || !msg.content.startsWith("file://")) return;
      setFailedOcrIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      try {
        const base64 = await FileSystem.readAsStringAsync(msg.content, {
          encoding: FileSystem.EncodingType.Base64,
        });
        sendOcr(base64, onOcrFail);
      } catch {
        setFailedOcrIds((prev) => new Set(prev).add(messageId));
      }
    },
    [messages, sendOcr],
  );

  const handlePlayAudio = useCallback(
    (msgId: string, audioUri: string) => playAudio(msgId, audioUri),
    [playAudio],
  );
```

- [ ] **Step 4: renderItem 包裹 useCallback，使用稳定回调**

将第 235-285 行的 `function renderItem(...)` 整体替换为：

```tsx
  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === "separator") {
        return <DateSeparator label={item.label} />;
      }
      if (item.type === "typing") {
        return (
          <View style={styles.typingWrapper}>
            <TypingIndicator />
          </View>
        );
      }
      const msg = item.data;

      return (
        <View style={styles.bubbleWrapper}>
          <ChatBubble
            message={msg}
            categories={categories}
            onDelete={handleDelete}
            onEditRecord={
              msg.content_type === "bill_card" ? handleEditRecord : undefined
            }
            isPlaying={playingId === msg.id}
            onPlay={
              msg.content_type === "audio" && msg.audio_uri
                ? () => handlePlayAudio(msg.id, msg.audio_uri!)
                : undefined
            }
            onResendOcr={
              msg.content_type === "image" &&
              msg.content.startsWith("file://") &&
              failedOcrIds.has(msg.id)
                ? handleResendOcr
                : undefined
            }
          />
        </View>
      );
    },
    [categories, handleDelete, handleEditRecord, handleResendOcr, handlePlayAudio, playingId, failedOcrIds],
  );
```

- [ ] **Step 5: 删除不再需要的 handleResendOcr 旧函数**

删除第 154-168 行的 `async function handleResendOcr(imagePath: string, imageMessageId: string)` 函数（已被 Step 3 中的 useCallback 版本替代）。

- [ ] **Step 6: 验证编译和功能**

```bash
cd apps/mobile && npx expo start --clear
```

验证：
1. AI 页正常打开，消息列表显示正确
2. 日期分隔符正常显示
3. 发送文字消息 → 正常
4. 长按消息 → 删除弹窗正常
5. 点击账单卡片编辑 → 跳转正常
6. 键盘弹出/收起 → 列表不闪烁

- [ ] **Step 7: 提交**

```bash
git add apps/mobile/app/index.tsx
git commit -m "perf: optimize FlatList with useMemo, useCallback, stable callbacks"
```

---

### Task 5: SQLite 加 created_at 索引

**Files:**
- Modify: `apps/mobile/lib/db/schema.ts:94-118` (runMigrations 函数)

- [ ] **Step 1: 在 runMigrations 末尾加索引**

在 `schema.ts` 的 `runMigrations` 函数末尾（第 117 行 `addColumnIfNotExists(db, "chat_messages", "duration_seconds", "INTEGER")` 之后）添加：

```ts
  // 聊天消息按时间排序的索引，加速 ORDER BY created_at DESC LIMIT 查询
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC)"
  );
```

- [ ] **Step 2: 验证编译无错**

```bash
cd apps/mobile && npx expo start --clear
```

打开应用，确认正常启动（migration 自动运行）。

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/lib/db/schema.ts
git commit -m "perf: add SQLite index on chat_messages.created_at"
```

---

### Task 6: 合并 invalidateQueries

**Files:**
- Modify: `apps/mobile/hooks/useLocalChatMessages.ts:41-66` (useAddChatMessage)
- Modify: `apps/mobile/hooks/useChat.ts`

- [ ] **Step 1: useAddChatMessage 支持 skipInvalidate**

在 `apps/mobile/hooks/useLocalChatMessages.ts` 中修改 `useAddChatMessage`：

**1a. 修改 hook 签名，接收 options 参数：**

将：
```ts
export function useAddChatMessage() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddMessageInput): Promise<string> => {
```

改为：
```ts
export function useAddChatMessage(options?: { skipInvalidate?: boolean }) {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddMessageInput): Promise<string> => {
```

**1b. onSuccess 中检查 skipInvalidate：**

将：
```ts
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
    },
```

改为：
```ts
    onSuccess: () => {
      if (!options?.skipInvalidate) {
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
      }
    },
```

- [ ] **Step 2: useChat 中传入 skipInvalidate 并合并 invalidate**

在 `apps/mobile/hooks/useChat.ts` 中：

**2a. addMessage 调用改为跳过自动 invalidate：**

将第 43 行：
```ts
  const { mutateAsync: addMessage } = useAddChatMessage();
```

改为：
```ts
  const { mutateAsync: addMessage } = useAddChatMessage({ skipInvalidate: true });
```

**2b. processText 中合并 invalidate**

将 processText 的 try/catch 块内的多次 `qc.invalidateQueries` 合并。修改后的 processText：

```ts
  const processText = useCallback(
    async (text: string) => {
      console.log("[processText] 输入:", text);

      const thinkingMsgId = await addMessage({
        role: "assistant",
        content_type: "text",
        content: "思考中...",
      });

      try {
        const resp = await apiFetch<ChatResponse>("/chat", {
          method: "POST",
          body: JSON.stringify({ text }),
        });

        console.log("[processText] /chat 返回:", JSON.stringify(resp.data));

        if (resp.data.type === "bill") {
          const tx = resp.data.transaction;
          const categoriesData = qc.getQueryData<readonly Category[]>([
            "categories",
          ]);
          const otherName = tx.type === "income" ? "其他收入" : "其他支出";
          const category =
            (tx.category
              ? categoriesData?.find(
                  (c) => c.name === tx.category && c.type === tx.type,
                )
              : null) ?? categoriesData?.find((c) => c.name === otherName);

          const occurredAt = tx.occurred_at || new Date().toISOString();
          const txId = await createTransaction({
            amount: tx.amount,
            category_id: category?.id ?? "",
            type: tx.type,
            note: tx.note,
            occurred_at: occurredAt,
            source: "llm",
          });

          await db!.runAsync(
            "UPDATE chat_messages SET content_type = ?, content = ?, transaction_id = ? WHERE id = ?",
            "bill_card",
            JSON.stringify({
              id: txId,
              amount: tx.amount,
              type: tx.type,
              note: tx.note,
              category_id: category?.id ?? "",
              occurred_at: occurredAt,
            }),
            txId,
            thinkingMsgId,
          );
        } else {
          await db!.runAsync(
            "UPDATE chat_messages SET content = ? WHERE id = ?",
            resp.data.content,
            thinkingMsgId,
          );
        }
      } catch (err) {
        console.error("[processText] /chat 异常:", err);
        await db!.runAsync(
          "UPDATE chat_messages SET content = ? WHERE id = ?",
          "处理失败，请稍后再试。",
          thinkingMsgId,
        );
      } finally {
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
      }
    },
    [qc, addMessage, createTransaction, db],
  );
```

关键变更：删除 try 块内的 3 处 `qc.invalidateQueries`，改为 `finally` 块中统一调用一次。

**2c. sendText 中合并 invalidate**

将 sendText 改为：

```ts
  const sendText = useCallback(
    async (text: string) => {
      if (!db) return;
      console.log("[sendText] 文字输入:", text);
      await addMessage({ role: "user", content_type: "text", content: text });
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
      try {
        await processText(text);
      } catch (err) {
        console.error("[sendText] ❌ processText 异常:", err);
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "网络错误，请重试。",
        });
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
      }
    },
    [db, qc, addMessage, processText],
  );
```

关键变更：用户消息 addMessage 后立即手动 invalidate 一次（让用户消息立刻显示），processText 内部会在 finally 中再 invalidate 一次（显示 AI 回复）。总共 2 次，替代原来的 4-5 次。

**2d. sendOcr 中合并 invalidate**

在 sendOcr 中，`addMessage` 调用不再自动 invalidate。改为在关键节点手动 invalidate：

在第 173 行 `const imageMessageId = await addMessage(...)` 之后加：
```ts
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
```

然后在 sendOcr 的 try/catch/finally 块中，将 try 块末尾已有的 `qc.invalidateQueries({ queryKey: ["transactions"] })` 之后加：
```ts
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
```

在 catch 块末尾也加：
```ts
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
```

这样 sendOcr 全流程最多 2 次 chat-messages invalidate（图片消息显示 1 次 + 结果显示 1 次），替代原来的 4-5 次。

**2e. sendAsr 中合并 invalidate**

sendAsr 的改法同理。将完整的 sendAsr 替换为：

```ts
  const sendAsr = useCallback(
    async (audioBase64: string, durationSeconds: number) => {
      if (!db) return;

      // 1. 保存音频文件到本地
      let audioUri: string | null = null;
      try {
        const dir = `${FileSystem.documentDirectory}voice-messages/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        audioUri = `${dir}${Date.now()}-${Crypto.randomUUID()}.m4a`;
        await FileSystem.writeAsStringAsync(audioUri, audioBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (err) {
        console.error("[sendAsr] 音频保存失败:", err);
      }

      // 2. 乐观渲染：立即显示语音气泡
      const msgId = await addMessage({
        role: "user",
        content_type: "audio",
        content: "[语音]",
        audio_uri: audioUri,
        duration_seconds: durationSeconds,
      });
      qc.invalidateQueries({ queryKey: ["chat-messages"] });

      // 3. 检查网络
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "未联网，无法使用语音服务。",
        });
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
        return;
      }

      // 4. 调用 /chat（后端做 ASR + classify_intent）
      console.log("[sendAsr] → 调用 /chat (语音)");
      const thinkingMsgId = await addMessage({
        role: "assistant",
        content_type: "text",
        content: "思考中...",
      });
      qc.invalidateQueries({ queryKey: ["chat-messages"] });

      try {
        const resp = await apiFetch<ChatResponse>("/chat", {
          method: "POST",
          body: JSON.stringify({ audioBase64 }),
        });

        console.log("[sendAsr] /chat 返回:", JSON.stringify(resp.data));

        // 更新语音气泡的转写文字
        const asrText = resp.data.asrText;
        if (asrText) {
          await db.runAsync(
            "UPDATE chat_messages SET content = ? WHERE id = ?",
            asrText,
            msgId,
          );
        }

        if (resp.data.type === "bill") {
          const tx = resp.data.transaction;
          const categoriesData = qc.getQueryData<readonly Category[]>([
            "categories",
          ]);
          const otherName = tx.type === "income" ? "其他收入" : "其他支出";
          const category =
            (tx.category
              ? categoriesData?.find(
                  (c) => c.name === tx.category && c.type === tx.type,
                )
              : null) ?? categoriesData?.find((c) => c.name === otherName);

          const occurredAt = tx.occurred_at || new Date().toISOString();
          const txId = await createTransaction({
            amount: tx.amount,
            category_id: category?.id ?? "",
            type: tx.type,
            note: tx.note,
            occurred_at: occurredAt,
            source: "asr",
          });

          await db.runAsync(
            "UPDATE chat_messages SET content_type = ?, content = ?, transaction_id = ? WHERE id = ?",
            "bill_card",
            JSON.stringify({
              id: txId,
              amount: tx.amount,
              type: tx.type,
              note: tx.note,
              category_id: category?.id ?? "",
              occurred_at: occurredAt,
            }),
            txId,
            thinkingMsgId,
          );
        } else {
          await db.runAsync(
            "UPDATE chat_messages SET content = ? WHERE id = ?",
            resp.data.content,
            thinkingMsgId,
          );
        }
      } catch (err) {
        console.error("[sendAsr] ❌ 异常:", err);
        await db.runAsync(
          "UPDATE chat_messages SET content = ? WHERE id = ?",
          "没听清，要不再说一次？",
          thinkingMsgId,
        );
      } finally {
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
      }
    },
    [db, qc, addMessage, createTransaction],
  );
```

关键变更：用户消息立即 invalidate 1 次（显示气泡），思考消息 invalidate 1 次（显示"思考中..."），最终结果在 finally 中 invalidate 1 次。总共 3 次（替代原来的 5-6 次），且每次都有明确的 UI 目的。

- [ ] **Step 3: 验证完整功能**

```bash
cd apps/mobile && npx expo start --clear
```

验证：
1. 发送文字消息 → 用户消息立即出现，AI 回复正常显示
2. 拍照记账 → 图片气泡出现，账单卡片正常生成
3. 语音记账 → 语音气泡出现，转写文字更新，账单卡片正常
4. 删除消息 → 正常消失（这走的是 useDeleteChatMessage，不受 skipInvalidate 影响）

- [ ] **Step 4: 提交**

```bash
git add apps/mobile/hooks/useLocalChatMessages.ts apps/mobile/hooks/useChat.ts
git commit -m "perf: consolidate invalidateQueries calls in useChat"
```

---

### Task 7: 端到端验证

- [ ] **Step 1: 完整验证清单**

重新启动应用，执行以下验证：

1. **进入性能**：从日记 Tab 点击 AI 按钮 → 页面应无明显冻住/白屏（即使有 15+ 张 OCR 图片）
2. **键盘交互**：点击输入框弹出键盘 → 列表不闪烁/不卡顿
3. **发送文字**：输入文字发送 → 消息正常显示
4. **发送图片**：拍照记账 → 图片显示、账单卡片生成正常
5. **语音记账**：录音发送 → 语音气泡、转写、账单卡片正常
6. **删除消息**：长按消息 → 删除弹窗 → 消息消失
7. **编辑账单**：点击账单卡片编辑按钮 → 跳转到手动记账页正常
8. **加载更多**：滚动到顶部 → 触发加载更多 → 历史消息正常加载
9. **图片查看**：点击 OCR 图片 → 进入大图查看 → 缩放/返回正常
10. **清空记录**：点击右上角垃圾桶 → 确认 → 所有消息消失

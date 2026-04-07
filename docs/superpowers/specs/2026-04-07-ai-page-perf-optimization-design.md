# AI 页面性能优化设计

## 问题

从其他 Tab 进入 AI 聊天页时有明显卡顿（冻住/白屏），即使已有 `LIMIT 30` 和 `staleTime: Infinity` 的优化。主要原因是多个性能问题叠加：OCR 图片重复解码、FlatList 无效重渲染、数据层冗余查询。

用户场景：聊天记录中 50%+ 是 OCR 拍照消息，30 条消息中 15+ 张图片在 mount 时同时解码阻塞 UI 线程。

## 方案概览

在当前 Stack 路由架构不变的前提下，做三层优化：

1. **图片缓存** — 消除重复解码
2. **FlatList 渲染优化** — 消除无效重渲染
3. **数据层优化** — 减少查询和刷新次数

## 1. 图片缓存（ImagePreview.tsx）

**现状**：`ImagePreview.tsx` 使用 React Native 内置 `<Image>`，对 `file://` URI 没有缓存。每次 FlatList 将 OcrBubble 滚入视口或组件 remount 都重新从磁盘读取并解码图片。

**改动**：
- `import { Image } from 'react-native'` → `import { Image } from 'expo-image'`
- `source={{ uri }}` → `source={uri}`
- `resizeMode="cover"` → `contentFit="cover"`

**效果**：expo-image 内置内存+磁盘缓存，相同 URI 第二次渲染零解码开销。

**涉及文件**：`apps/mobile/components/ui/ImagePreview.tsx`

## 2. FlatList 渲染优化（index.tsx + ChatBubble.tsx）

### 2a. buildListItems 加 useMemo

**现状**：`index.tsx:220` 每次渲染都重新执行 `buildListItems`（遍历 + reverse），键盘弹出、metering 变化等任何 state 更新都触发重算并生成新数组引用。

**改动**：包 `useMemo`，依赖 `[messages, isSending]`。

### 2b. renderItem 加 useCallback

**现状**：`index.tsx:235` 的 `renderItem` 是内联函数，每次渲染产生新引用，FlatList 无法跳过未变化的 item。

**改动**：包 `useCallback`，依赖 `[categories, deleteMutation, playingId, failedOcrIds]`。

### 2c. ChatBubble 加 React.memo

**现状**：`ChatBubble` 没有 `React.memo`，即使 props 完全相同也会重渲染。

**改动**：导出改为 `React.memo(ChatBubble)`。

### 2d. 稳定 renderItem 内的回调引用

**现状**：`onDelete={() => deleteMutation.mutate(msg.id)}` 等内联回调每次渲染都生成新引用，击穿 `React.memo`。

**改动**：ChatBubble 接收 `messageId` + 稳定的 `onDelete(id: string)` 回调，由 ChatBubble 内部调用。

**涉及文件**：`apps/mobile/app/index.tsx`、`apps/mobile/components/chat/ChatBubble.tsx`

## 3. 数据层优化（schema.ts + useChat.ts + useLocalChatMessages.ts）

### 3a. SQLite 加索引

**现状**：`chat_messages` 表没有 `created_at` 索引，`ORDER BY created_at DESC LIMIT 30` 需全表扫描排序。

**改动**：在 `schema.ts` 的 `runMigrations` 中加：
```sql
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC)
```

### 3b. 合并 invalidateQueries

**现状**：一次 `processText` 触发 2 次 `invalidateQueries`（addMessage 的 onSuccess + 流程末尾手动调用）。`sendAsr` 最多 4-5 次。每次都重查 SQLite + 触发 FlatList 重渲染。

**改动**：
- `useAddChatMessage` 新增 `skipInvalidate` 选项
- `useChat` 内部调用时传 `skipInvalidate: true`
- 每个流程（processText/sendOcr/sendAsr）末尾统一 invalidate 一次

**涉及文件**：`apps/mobile/lib/db/schema.ts`、`apps/mobile/hooks/useChat.ts`、`apps/mobile/hooks/useLocalChatMessages.ts`

## 涉及文件汇总

| 文件 | 改动类型 |
|------|---------|
| `apps/mobile/components/ui/ImagePreview.tsx` | Image → expo-image |
| `apps/mobile/app/index.tsx` | useMemo, useCallback, 稳定回调 |
| `apps/mobile/components/chat/ChatBubble.tsx` | React.memo, 接收 messageId |
| `apps/mobile/lib/db/schema.ts` | 加 created_at 索引 |
| `apps/mobile/hooks/useLocalChatMessages.ts` | skipInvalidate 选项 |
| `apps/mobile/hooks/useChat.ts` | 合并 invalidateQueries |

## 不做的事

- 不改路由架构（Stack → Tab 留待后续）
- 不加 `getItemLayout`（气泡高度不固定，不适用）
- 不改 VoiceBubble 动画（不是进入卡顿的原因）

## 验证

1. 进入 AI 页（含 15+ 张 OCR 图片）→ 无明显冻住/白屏
2. 键盘弹出/收起 → 列表不卡顿
3. 发送消息 → 消息正常显示，FlatList 只刷新一次（而非 3-5 次）
4. 删除消息 → 正常消失
5. 加载更多历史 → 正常翻页

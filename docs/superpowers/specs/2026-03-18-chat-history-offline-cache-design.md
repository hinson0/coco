# 聊天历史加载 + 离线缓存 + 消息管理

**日期**: 2026-03-18
**状态**: Draft

## 背景

聊天页（`apps/mobile/app/index.tsx`）的消息数据存储在 Zustand 内存 store 中，每次启动 app 都是空数组。后端 Supabase 已完整保存用户消息和 assistant 消息（`chat_messages` 表），且 `GET /api/chat/messages` 已实现分页查询。问题在于前端从未调用该 API 加载历史。

同时，日记页每次打开都需要重新拉取数据，体验较慢。

## 目标

1. 聊天页启动时加载历史消息，支持向上滚动加载更多
2. 离线缓存：聊天页和日记页都能在无网时展示缓存数据
3. 支持删除单条消息和清空全部聊天记录

## 设计

### 1. 数据获取层：useInfiniteQuery 替代 chatStore 的 messages

消息数据源从 Zustand 迁移到 React Query。

- 新建 `hooks/useChatMessages.ts`，使用 `useInfiniteQuery` 调用 `GET /api/chat/messages?page={n}&limit=30`
- 客户端固定传 `limit=30`（API 默认 50，但 30 条更适合移动端首屏加载量）
- 按 `created_at DESC` 排序（API 已支持分页）
- `getNextPageParam`：基于 `page * limit < total` 判断是否还有下一页，有则返回 `page + 1`
- FlatList 的 `onEndReached` 触发 `fetchNextPage`（列表 inverted，"到底"即加载更早的消息）
- 加载更多时在列表顶部（inverted 后视觉顶部）显示一个轻量 spinner

chatStore 简化为：

- `isLoading`：发送中状态
- `pendingMessages`：乐观插入的、还没被服务端确认的消息，类型为 `PendingMessage`

```typescript
interface PendingMessage extends ChatMessage {
  readonly status: 'pending' | 'failed';
  readonly clientId: string; // 用于去重，同时作为 ChatMessage.id 的值
}
```

> `PendingMessage.id` 使用 `clientId` 的值（UUID v4），在消息确认入库后由服务端分配真正的 UUID。

消息合并逻辑：展示时将 `query.data.pages` 扁平化 + `pendingMessages` 合并，按 `created_at` 排序。

**欢迎消息**：不参与排序，而是在渲染时硬编码为 inverted FlatList 的最后一项（视觉上的最顶部）。仅当服务端返回 total === 0 且无 pendingMessages 时显示。

### 2. 消息发送流程（useChat 改造）

发送消息的完整流程：

1. 用户输入 → 创建 `PendingMessage`（status: 'pending'，clientId: uuid）→ 加入 `pendingMessages` → 立即展示
2. 调用 API（如 `/api/record/text`、`/api/record/ocr`、`/api/record/asr`）
3. **成功**：API 响应中拿到 assistant 消息 → 用 `queryClient.setQueryData` 将**用户消息（从 pending 转为正式，使用服务端已生成的数据）和 assistant 消息**一起插入第一页缓存 → 从 `pendingMessages` 中移除该 pending 消息
4. **失败**：将该 pending 消息的 status 改为 'failed' → 气泡上显示红色感叹号 → 点击触发重试（复用原 clientId）

> **三个发送方法（sendText / sendOcr / sendAsr）遵循相同的 pending → setQueryData → failed 流程**，区别仅在 API 端点和 content_type 不同。

错误消息（如"网络错误，请重试"）不持久化到服务端，仅作为 failed 状态的 pendingMessage 存在于客户端。

> 注意：用户消息已由 API 端写入 Supabase（如 `route.ts` 第 29-31 行），所以成功后 setQueryData 插入的用户消息数据可信。如果不立即插入，用户消息要等到下次 refetch（最长 30 秒）才出现在正式缓存中。

### 3. 离线缓存：React Query 持久化

使用 `PersistQueryClientProvider`（替换现有的 `QueryClientProvider`）+ `createAsyncStoragePersister`（基于 `@react-native-async-storage/async-storage`）。

在 app 入口（`_layout.tsx`）配置，`queryClient` 的 `defaultOptions.queries.gcTime` 设为 7 天。

通过 `shouldDehydrateQuery` 白名单持久化以下 query keys（**前缀匹配**，即 `queryKey[0]` 匹配）：

| Query Key 前缀 | 数据 | 持久化限制 |
|----------------|------|-----------|
| `"chat-messages"` | 聊天记录 | 最多 3 页（90 条） |
| `"transactions"` | 交易列表 | 全部已加载页 |
| `"budgets"` | 预算 | 全部 |
| `"categories"` | 分类 | 全部 |

- `staleTime`：30 秒（避免 inverted list 因立即 refetch 导致内容跳变）
- `gcTime`：7 天（缓存保留周期）

效果：打开 app → 立即展示缓存（30 秒内不触发 refetch）→ 超过 30 秒或手动刷新时后台静默更新 → 无感替换。

### 4. 消息删除 / 清空聊天记录

**API 端点设计**（与项目现有 transactions 的 `[id]` 模式一致）：

- 单条删除：`DELETE /api/chat/messages/[id]`（新建 `apps/api/src/app/api/chat/messages/[id]/route.ts`）
- 清空全部：`DELETE /api/chat/messages`（在现有 `route.ts` 中新增 DELETE handler）

**删除策略**：硬删除。原因：聊天消息无审计需求，且 `chat_messages` 表的 RLS 策略是 `FOR ALL USING (user_id = auth.uid())`，已覆盖 DELETE 操作，无需额外调整。与 transactions 的软删除不同，聊天消息不需要恢复功能。

**前端交互**：

- 单条消息：长按 → 操作菜单 → "删除"（带确认）
- 清空全部：顶部栏 `···` 按钮 → "清空聊天记录"（Alert 确认）

**乐观更新**：删除时先用 `queryClient.setQueryData` 从缓存中移除对应消息，API 失败则回滚 + toast 提示。清空全部成功后，额外清除 AsyncStorage 中 `chat-messages` 的持久化缓存。

### 5. 错误处理

- 网络断开时发送消息失败：pendingMessage 标记为 `status: 'failed'`，气泡显示红色感叹号，点击重试
- 离线缓存过期（7 天 gcTime）：缓存自动清除，联网后重新拉取
- 分页边界：total 为 0 时只显示欢迎消息，不触发加载更多
- 乐观更新冲突：删除失败时回滚缓存 + toast 提示

## 文件变更

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `apps/mobile/hooks/useChatMessages.ts` | 新建 | `useInfiniteQuery` 拉取聊天历史 |
| `apps/mobile/store/chatStore.ts` | 修改 | 简化为 pendingMessages（含 status 字段）+ isLoading |
| `apps/mobile/hooks/useChat.ts` | 修改 | 发送后用 setQueryData 插入缓存 + 管理 pendingMessages |
| `apps/mobile/app/index.tsx` | 修改 | 用 `useChatMessages` 替代 store.messages，FlatList 接 `onEndReached`，`···` 按钮接清空 |
| `apps/mobile/app/_layout.tsx` | 修改 | `PersistQueryClientProvider` 替换 `QueryClientProvider` + AsyncStorage |
| `apps/api/src/app/api/chat/messages/route.ts` | 修改 | 新增 DELETE handler（清空全部） |
| `apps/api/src/app/api/chat/messages/[id]/route.ts` | 新建 | DELETE handler（单条删除） |
| `apps/mobile/components/chat/ChatBubble.tsx` | 修改 | 长按菜单（删除）+ 失败状态 UI |

## 新增依赖

- `@tanstack/react-query-persist-client`
- `@tanstack/query-async-storage-persister`（TanStack Query v5 的 AsyncStorage persister）
- `@react-native-async-storage/async-storage`（如项目尚未安装）

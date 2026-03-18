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

- 新建 `hooks/useChatMessages.ts`，使用 `useInfiniteQuery` 调用 `GET /api/chat/messages`
- 每页 30 条，按 `created_at DESC` 排序（API 已支持分页）
- `getNextPageParam` 基于当前页码和 total 判断是否还有更多
- FlatList 的 `onEndReached` 触发 `fetchNextPage`（列表 inverted，"到底"即加载更早的消息）

chatStore 简化为：

- `isLoading`：发送中状态
- `pendingMessages`：乐观插入的、还没被服务端确认的消息
- `addPendingMessage` / `removePendingMessage`

消息合并逻辑：展示时将 `query.data.pages` 扁平化 + `pendingMessages` 合并，按 `created_at` 排序。欢迎消息作为固定首条拼在最前面（纯前端，不入库）。

### 2. 离线缓存：React Query 持久化

使用 `@tanstack/react-query-persist-client` + `createAsyncStoragePersister`（基于 `@react-native-async-storage/async-storage`）。

在 app 入口（`_layout.tsx`）配置 `PersistQueryClient`，通过 `shouldDehydrateQuery` 白名单持久化以下 query keys：

| Query Key | 数据 |
|-----------|------|
| `["chat-messages"]` | 聊天记录 |
| `["transactions", page]` | 交易列表 |
| `["budgets"]` | 预算 |
| `["categories"]` | 分类 |

- `gcTime`：7 天（缓存保留周期）
- `staleTime`：0（每次打开都尝试刷新，无网时降级到缓存）

效果：打开 app → 立即展示缓存 → 后台静默刷新 → 无感更新。

### 3. 消息删除 / 清空聊天记录

新增 API 端点：`DELETE /api/chat/messages`

- 删除单条：`DELETE /api/chat/messages?id={messageId}` — 硬删除
- 清空全部：`DELETE /api/chat/messages?all=true` — 删除当前用户所有消息

前端交互：

- 单条消息：长按 → 操作菜单 → "删除"（带确认）
- 清空全部：顶部栏 `···` 按钮 → "清空聊天记录"（Alert 确认）

乐观更新：删除时先从 React Query 缓存中移除，API 失败则回滚 + toast 提示。

### 4. 错误处理

- 网络断开时发送消息失败：消息标记为"发送失败"，可点击重试
- 离线缓存过期（7 天 gcTime）：缓存自动清除，联网后重新拉取
- 分页边界：total 为 0 时只显示欢迎消息
- 乐观更新冲突：删除失败时回滚缓存 + toast 提示

## 文件变更

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `apps/mobile/hooks/useChatMessages.ts` | 新建 | `useInfiniteQuery` 拉取聊天历史 |
| `apps/mobile/store/chatStore.ts` | 修改 | 简化为 pendingMessages + isLoading |
| `apps/mobile/hooks/useChat.ts` | 修改 | 发送后 invalidate query 而非手动 addMessage |
| `apps/mobile/app/index.tsx` | 修改 | 用 `useChatMessages` 替代 store.messages，FlatList 接 `onEndReached` |
| `apps/mobile/app/_layout.tsx` | 修改 | 配置 `PersistQueryClient` + AsyncStorage |
| `apps/api/src/app/api/chat/messages/route.ts` | 修改 | 新增 DELETE handler |
| `apps/mobile/components/chat/ChatBubble.tsx` | 修改 | 长按菜单（删除单条） |
| `apps/mobile/app/index.tsx` 顶栏 | 修改 | `···` 按钮接清空功能 |

## 新增依赖

- `@tanstack/react-query-persist-client`
- `@react-native-async-storage/async-storage`（如项目尚未安装）

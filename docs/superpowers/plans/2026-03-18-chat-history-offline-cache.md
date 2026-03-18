# 聊天历史 + 离线缓存 + 消息管理 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让聊天页加载历史消息（无限滚动），为聊天页和日记页添加离线缓存，支持删除/清空聊天记录。

**Architecture:** 用 React Query `useInfiniteQuery` 替代 Zustand 内存 store 作为消息数据源；用 `PersistQueryClientProvider` + AsyncStorage 实现离线持久化（覆盖聊天和日记页的 query keys）；新增 DELETE API 端点 + 前端长按/清空交互。

**Tech Stack:** React Native (Expo), TanStack React Query v5, AsyncStorage, Zustand, Next.js API Routes, Supabase

**注意：用户亲手写代码，本计划中的代码片段作为引导参考，由用户 review 后自行落盘。**

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/shared/src/types/chat.ts` | 修改 | 新增 `PendingMessage` 类型 |
| `apps/mobile/store/chatStore.ts` | 重写 | 简化为 pendingMessages + isLoading |
| `apps/mobile/hooks/useChatMessages.ts` | 新建 | `useInfiniteQuery` 拉取聊天历史 |
| `apps/mobile/hooks/useChat.ts` | 重写 | pending 流程 + setQueryData |
| `apps/mobile/hooks/useDeleteChatMessage.ts` | 新建 | 单条删除 + 清空全部的 mutations |
| `apps/api/src/app/api/chat/messages/route.ts` | 修改 | 新增 DELETE handler（清空全部） |
| `apps/api/src/app/api/chat/messages/[id]/route.ts` | 新建 | DELETE handler（单条删除） |
| `apps/mobile/app/_layout.tsx` | 修改 | PersistQueryClientProvider + AsyncStorage |
| `apps/mobile/components/chat/ChatBubble.tsx` | 修改 | 长按菜单 + 失败状态 UI |
| `apps/mobile/app/index.tsx` | 修改 | 接入 useChatMessages + onEndReached + 清空按钮 |

---

## Task 1: 新增 PendingMessage 类型

**Files:**
- Modify: `packages/shared/src/types/chat.ts`

- [ ] **Step 1: 在 `chat.ts` 末尾添加 PendingMessage 接口**

```typescript
export interface PendingMessage extends ChatMessage {
  readonly status: 'pending' | 'failed';
  readonly clientId: string;
}
```

> `clientId` 同时作为 `ChatMessage.id` 的值（UUID v4），服务端确认后替换为真正的 UUID。

- [ ] **Step 2: 验证类型导出**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: 无错误（类型通过 `index.ts` 的 `export * from "./types/chat"` 自动导出）

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types/chat.ts
git commit -m "feat(shared): add PendingMessage type for optimistic chat messages"
```

---

## Task 2: 重写 chatStore

**Files:**
- Modify: `apps/mobile/store/chatStore.ts`

- [ ] **Step 1: 重写 chatStore 为 pending-only store**

```typescript
import { create } from "zustand";
import type { PendingMessage } from "@coco/shared";

interface ChatState {
  readonly pendingMessages: readonly PendingMessage[];
  readonly isLoading: boolean;
  addPending: (msg: PendingMessage) => void;
  removePending: (clientId: string) => void;
  markFailed: (clientId: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  pendingMessages: [],
  isLoading: false,
  addPending: (msg) =>
    set((s) => ({ pendingMessages: [...s.pendingMessages, msg] })),
  removePending: (clientId) =>
    set((s) => ({
      pendingMessages: s.pendingMessages.filter((m) => m.clientId !== clientId),
    })),
  markFailed: (clientId) =>
    set((s) => ({
      pendingMessages: s.pendingMessages.map((m) =>
        m.clientId === clientId ? { ...m, status: "failed" as const } : m
      ),
    })),
  setLoading: (isLoading) => set({ isLoading }),
}));
```

> 关键变化：`messages` 和 `addMessage` / `setMessages` 全部移除，消息数据源迁移到 React Query。

- [ ] **Step 2: 验证编译**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: 会有编译错误（`useChat.ts` 和 `index.tsx` 还在引用旧 API），这是预期的，后续 Task 修复。

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/store/chatStore.ts
git commit -m "refactor(mobile): simplify chatStore to pending-only store"
```

---

## Task 3: 新建 useChatMessages hook

**Files:**
- Create: `apps/mobile/hooks/useChatMessages.ts`

- [ ] **Step 1: 创建 useChatMessages hook**

```typescript
import { useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type { ChatMessage, PaginatedResponse } from "@coco/shared";

const PAGE_SIZE = 30;

export function useChatMessages() {
  return useInfiniteQuery({
    queryKey: ["chat-messages"],
    queryFn: ({ pageParam = 1 }) =>
      apiFetch<PaginatedResponse<ChatMessage>>(
        `/api/chat/messages?page=${pageParam}&limit=${PAGE_SIZE}`
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.limit;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });
}
```

> `getNextPageParam`：当已加载条数 < total 时返回下一页页码，否则 `undefined`（没有更多）。
> 查询 key 为 `["chat-messages"]`，与日记页的 `["transactions", page]` 独立。

- [ ] **Step 2: 验证编译**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: 此文件本身不应有错误（但其他文件可能仍有错误）

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/hooks/useChatMessages.ts
git commit -m "feat(mobile): add useChatMessages hook with infinite query"
```

---

## Task 4: 重写 useChat hook

**Files:**
- Modify: `apps/mobile/hooks/useChat.ts`

- [ ] **Step 1: 重写 useChat，接入 pending 流程 + setQueryData**

```typescript
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { useChatStore } from "../store/chatStore";
import type { InfiniteData } from "@tanstack/react-query";
import type { ChatMessage, PendingMessage, PaginatedResponse } from "@coco/shared";

type ChatInfiniteData = InfiniteData<PaginatedResponse<ChatMessage>>;

function createPendingMessage(
  overrides: Pick<ChatMessage, "content_type" | "content">
): PendingMessage {
  // React Native 支持 crypto.randomUUID()（Hermes 引擎）
  const clientId = crypto.randomUUID();
  return {
    id: clientId,
    user_id: "",
    role: "user",
    content_type: overrides.content_type,
    content: overrides.content,
    transaction_id: null,
    created_at: new Date().toISOString(),
    status: "pending",
    clientId,
  };
}

/** 将用户消息和 assistant 消息插入 React Query 缓存的第一页 */
function insertMessagesIntoCache(
  qc: ReturnType<typeof useQueryClient>,
  userMsg: ChatMessage,
  assistantMsg: ChatMessage
) {
  qc.setQueryData<ChatInfiniteData>(["chat-messages"], (old) => {
    if (!old) return old;
    const firstPage = old.pages[0];
    if (!firstPage) return old;
    // 第一页按 created_at DESC 排序，新消息插入头部
    return {
      ...old,
      pages: [
        {
          ...firstPage,
          data: [assistantMsg, userMsg, ...firstPage.data],
          total: firstPage.total + 2,
        },
        ...old.pages.slice(1).map((p) => ({ ...p, total: p.total + 2 })),
      ],
    };
  });
}

export function useChat() {
  const { addPending, removePending, markFailed, setLoading } = useChatStore();
  const qc = useQueryClient();

  const sendText = useCallback(async (text: string) => {
    const pending = createPendingMessage({ content_type: "text", content: text });
    addPending(pending);
    setLoading(true);
    try {
      const resp = await apiFetch<any>("/api/record/text", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      // 构造 assistant 消息
      let assistantMsg: ChatMessage;
      if (resp.data?.type === "bill") {
        assistantMsg = {
          id: resp.data.transaction.id,
          user_id: "",
          role: "assistant",
          content_type: "bill_card",
          content: JSON.stringify(resp.data.transaction),
          transaction_id: resp.data.transaction.id,
          created_at: new Date().toISOString(),
        };
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else if (resp.data?.type === "nl_result") {
        assistantMsg = {
          id: `asst-${Date.now()}`,
          user_id: "",
          role: "assistant",
          content_type: "nl_result",
          content: resp.data.message,
          transaction_id: null,
          created_at: new Date().toISOString(),
        };
      } else {
        assistantMsg = {
          id: `asst-${Date.now()}`,
          user_id: "",
          role: "assistant",
          content_type: "text",
          content: resp.data?.message ?? "处理完成",
          transaction_id: null,
          created_at: new Date().toISOString(),
        };
      }
      // 用户消息（从 pending 转正式）
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        user_id: "",
        role: "user",
        content_type: "text",
        content: text,
        transaction_id: null,
        created_at: pending.created_at,
      };
      insertMessagesIntoCache(qc, userMsg, assistantMsg);
      removePending(pending.clientId);
    } catch {
      markFailed(pending.clientId);
    } finally {
      setLoading(false);
    }
  }, [addPending, removePending, markFailed, setLoading, qc]);

  const sendOcr = useCallback(async (imageBase64: string) => {
    const pending = createPendingMessage({ content_type: "image", content: "[拍照]" });
    addPending(pending);
    setLoading(true);
    try {
      const resp = await apiFetch<any>("/api/record/ocr", {
        method: "POST",
        body: JSON.stringify({ imageBase64 }),
      });
      let assistantMsg: ChatMessage;
      if (resp.data?.type === "bill") {
        assistantMsg = {
          id: resp.data.transaction.id,
          user_id: "",
          role: "assistant",
          content_type: "bill_card",
          content: JSON.stringify(resp.data.transaction),
          transaction_id: resp.data.transaction.id,
          created_at: new Date().toISOString(),
        };
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        assistantMsg = {
          id: `asst-${Date.now()}`,
          user_id: "",
          role: "assistant",
          content_type: "text",
          content: resp.data?.message ?? "小票识别失败，请手动记账。",
          transaction_id: null,
          created_at: new Date().toISOString(),
        };
      }
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        user_id: "",
        role: "user",
        content_type: "image",
        content: "[拍照]",
        transaction_id: null,
        created_at: pending.created_at,
      };
      insertMessagesIntoCache(qc, userMsg, assistantMsg);
      removePending(pending.clientId);
    } catch {
      markFailed(pending.clientId);
    } finally {
      setLoading(false);
    }
  }, [addPending, removePending, markFailed, setLoading, qc]);

  const sendAsr = useCallback(async (audioBase64: string) => {
    const pending = createPendingMessage({ content_type: "audio", content: "[语音]" });
    addPending(pending);
    setLoading(true);
    try {
      const resp = await apiFetch<any>("/api/record/asr", {
        method: "POST",
        body: JSON.stringify({ audioBase64 }),
      });
      let assistantMsg: ChatMessage;
      if (resp.data?.type === "bill") {
        assistantMsg = {
          id: resp.data.transaction.id,
          user_id: "",
          role: "assistant",
          content_type: "bill_card",
          content: JSON.stringify(resp.data.transaction),
          transaction_id: resp.data.transaction.id,
          created_at: new Date().toISOString(),
        };
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        assistantMsg = {
          id: `asst-${Date.now()}`,
          user_id: "",
          role: "assistant",
          content_type: "text",
          content: resp.data?.message ?? "没听清，要不再说一次？",
          transaction_id: null,
          created_at: new Date().toISOString(),
        };
      }
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        user_id: "",
        role: "user",
        content_type: "audio",
        content: "[语音]",
        transaction_id: null,
        created_at: pending.created_at,
      };
      insertMessagesIntoCache(qc, userMsg, assistantMsg);
      removePending(pending.clientId);
    } catch {
      markFailed(pending.clientId);
    } finally {
      setLoading(false);
    }
  }, [addPending, removePending, markFailed, setLoading, qc]);

  return { sendText, sendOcr, sendAsr };
}
```

> 核心变化：
> - 发送前创建 `PendingMessage` 乐观展示
> - 成功后用 `setQueryData` 直接将用户消息 + assistant 消息插入第一页缓存顶部
> - 失败后 `markFailed`，不创建错误消息对象

- [ ] **Step 2: 验证编译**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: 仍有 `index.tsx` 的引用错误（下一个 Task 修复）

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/hooks/useChat.ts
git commit -m "refactor(mobile): rewrite useChat with pending flow and setQueryData"
```

---

## Task 5: DELETE API 端点

**Files:**
- Modify: `apps/api/src/app/api/chat/messages/route.ts`
- Create: `apps/api/src/app/api/chat/messages/[id]/route.ts`

- [ ] **Step 1: 在 `route.ts` 中新增 DELETE handler（清空全部）**

在现有 `GET` 下方添加：

```typescript
export const DELETE = withLogger(async (req) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: null, error: null });
});
```

- [ ] **Step 2: 新建 `[id]/route.ts`（单条删除）**

```typescript
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase";
import { withLogger } from "@/lib/logger";

export const DELETE = withLogger(async (req, { params }) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const token = req.headers.get("Authorization")!.slice(7);
  const supabase = createAuthClient(token);

  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: null, error: null });
});
```

> RLS 策略 `FOR ALL USING (user_id = auth.uid())` 已覆盖 DELETE，此处额外加 `.eq("user_id", auth.userId)` 作为双重保护。

- [ ] **Step 3: 验证 API 编译**

Run: `cd apps/api && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/app/api/chat/messages/route.ts apps/api/src/app/api/chat/messages/\[id\]/route.ts
git commit -m "feat(api): add DELETE endpoints for chat messages"
```

---

## Task 6: 新建 useDeleteChatMessage hook

**Files:**
- Create: `apps/mobile/hooks/useDeleteChatMessage.ts`

- [ ] **Step 1: 创建删除 hook（单条 + 清空）**

```typescript
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../lib/api";
import type { ApiResponse, ChatMessage, PaginatedResponse } from "@coco/shared";

type ChatInfiniteData = InfiniteData<PaginatedResponse<ChatMessage>>;

export function useDeleteChatMessage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiResponse<null>>(`/api/chat/messages/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["chat-messages"] });
      const previous = qc.getQueryData<ChatInfiniteData>(["chat-messages"]);

      qc.setQueryData<ChatInfiniteData>(["chat-messages"], (old) => {
        if (!old) return old;
        // 找到消息所在的页，仅该页移除；total 全局减 1
        let found = false;
        const newPages = old.pages.map((page) => {
          const filtered = page.data.filter((msg) => msg.id !== id);
          if (filtered.length < page.data.length) found = true;
          return { ...page, data: filtered };
        });
        if (!found) return old;
        return {
          ...old,
          pages: newPages.map((p) => ({ ...p, total: p.total - 1 })),
        };
      });

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(["chat-messages"], context.previous);
      }
      Alert.alert("删除失败", "请稍后重试");
    },
  });
}

export function useClearChatMessages() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<ApiResponse<null>>("/api/chat/messages", { method: "DELETE" }),
    onSuccess: async () => {
      qc.setQueryData<ChatInfiniteData>(["chat-messages"], {
        pages: [{ success: true, data: [], total: 0, page: 1, limit: 30 }],
        pageParams: [1],
      });
      // 清除 AsyncStorage 持久化缓存，防止冷启动时恢复已删除的消息
      await AsyncStorage.removeItem("REACT_QUERY_OFFLINE_CACHE");
    },
    onError: () => {
      Alert.alert("清空失败", "请稍后重试");
    },
  });
}
```

> `useDeleteChatMessage` 使用乐观更新：先从缓存移除，失败则回滚。
> `useClearChatMessages` 成功后直接将缓存设为空。

- [ ] **Step 2: 验证编译**

Run: `cd apps/mobile && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/hooks/useDeleteChatMessage.ts
git commit -m "feat(mobile): add useDeleteChatMessage and useClearChatMessages hooks"
```

---

## Task 7: 配置 PersistQueryClientProvider + 离线缓存

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: 安装依赖**

Run: `cd apps/mobile && pnpm add @tanstack/react-query-persist-client @tanstack/query-async-storage-persister`

> `@react-native-async-storage/async-storage` 已安装（v2.2.0）

- [ ] **Step 2: 重写 `_layout.tsx`**

```typescript
import { Slot, router } from "expo-router";
import { useEffect } from "react";
import { View, Text } from "react-native";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../hooks/useAuth";

const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;

const PERSISTED_KEY_PREFIXES = [
  "chat-messages",
  "transactions",
  "budgets",
  "categories",
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: SEVEN_DAYS,
    },
  },
});

const MAX_CHAT_PAGES_TO_PERSIST = 3;

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  // 自定义序列化：截断 chat-messages 只保留最近 3 页
  serialize: (data) => {
    const client = data as any;
    if (client?.clientState?.queries) {
      client.clientState.queries = client.clientState.queries.map((q: any) => {
        if (q.queryKey?.[0] === "chat-messages" && q.state?.data?.pages) {
          return {
            ...q,
            state: {
              ...q.state,
              data: {
                ...q.state.data,
                pages: q.state.data.pages.slice(0, MAX_CHAT_PAGES_TO_PERSIST),
                pageParams: q.state.data.pageParams.slice(0, MAX_CHAT_PAGES_TO_PERSIST),
              },
            },
          };
        }
        return q;
      });
    }
    return JSON.stringify(data);
  },
});

export default function RootLayout() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session) router.replace("/(auth)/login");
  }, [session, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F5F5" }}>
        <Text style={{ color: "#2D9B83", fontSize: 28, fontWeight: "800" }}>CoCo</Text>
      </View>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: SEVEN_DAYS,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey[0];
            return typeof key === "string" && PERSISTED_KEY_PREFIXES.includes(key);
          },
        },
      }}
    >
      <Slot />
    </PersistQueryClientProvider>
  );
}
```

> 关键点：
> - `PersistQueryClientProvider` 替换 `QueryClientProvider`
> - `shouldDehydrateQuery` 用前缀白名单过滤
> - `staleTime: 30s` 防止 inverted list 跳变
> - `gcTime: 7 天` 控制离线缓存保留周期

- [ ] **Step 3: 验证编译**

Run: `cd apps/mobile && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): add offline cache with PersistQueryClientProvider"
```

---

## Task 8: 改造 ChatBubble（长按删除 + 失败状态）

**Files:**
- Modify: `apps/mobile/components/chat/ChatBubble.tsx`

- [ ] **Step 1: 添加长按删除菜单和失败状态 UI**

需要改动的部分：

1. Props 新增 `onDelete?: () => void` 和 `status?: 'pending' | 'failed'`
2. 所有气泡外层包裹 `TouchableOpacity`，`onLongPress` 触发 `ActionSheetIOS.showActionSheetWithOptions` 或 `Alert.alert`（跨平台兼容）
3. 失败状态时气泡右侧/左侧显示红色感叹号 `⚠`，点击触发重试

```typescript
// 新增到 ChatBubbleProps 接口
interface ChatBubbleProps {
  readonly message: ChatMessage;
  readonly status?: 'pending' | 'failed';
  readonly onDelete?: () => void;
  readonly onRetry?: () => void;
  readonly transaction?: Transaction;
  readonly onConfirmRecord?: () => void;
  readonly onEditRecord?: () => void;
  readonly onSuggestion?: (label: string) => void;
}
```

长按菜单实现（在组件内部）：

```typescript
import { TouchableOpacity, Alert } from 'react-native';

function handleLongPress(onDelete?: () => void) {
  if (!onDelete) return;
  Alert.alert("消息操作", "", [
    { text: "删除", style: "destructive", onPress: onDelete },
    { text: "取消", style: "cancel" },
  ]);
}
```

失败状态指示器：

```typescript
function FailedIndicator({ onRetry }: { onRetry?: () => void }) {
  return (
    <TouchableOpacity onPress={onRetry} style={styles.failedIcon}>
      <AppText size="base" color={colors.error}>⚠</AppText>
    </TouchableOpacity>
  );
}
```

> 每个渲染分支（user text / user audio / assistant text 等）的最外层 `View` 改为 `TouchableOpacity`，加 `onLongPress`。失败状态在气泡旁边显示 `FailedIndicator`。

- [ ] **Step 2: 添加失败状态和长按相关样式**

```typescript
// 添加到 styles
failedIcon: {
  marginHorizontal: spacing.xs,
  justifyContent: 'center',
},
failedRow: {
  flexDirection: 'row',
  alignItems: 'center',
},
pendingOpacity: {
  opacity: 0.6,
},
```

- [ ] **Step 3: 验证编译**

Run: `cd apps/mobile && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/chat/ChatBubble.tsx
git commit -m "feat(mobile): add long-press delete and failed state to ChatBubble"
```

---

## Task 9: 改造 ChatScreen（接入所有新 hook）

**Files:**
- Modify: `apps/mobile/app/index.tsx`

这是最复杂的 Task，分步进行：

- [ ] **Step 1: 替换 import 和 hook 调用**

移除：
```typescript
import { useChatStore } from '../store/chatStore';
// 旧: const { messages, isLoading, addMessage } = useChatStore();
```

新增：
```typescript
import { useChatMessages } from '../hooks/useChatMessages';
import { useDeleteChatMessage, useClearChatMessages } from '../hooks/useDeleteChatMessage';
import { useChatStore } from '../store/chatStore';

// 在 ChatScreen 内部：
const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: isQueryLoading } = useChatMessages();
const { pendingMessages, isLoading: isSending } = useChatStore();
const deleteMutation = useDeleteChatMessage();
const clearMutation = useClearChatMessages();
```

- [ ] **Step 2: 重写消息合并逻辑**

替换现有的 `buildListItems` 调用：

```typescript
// 将所有页扁平化并转为 ASC（时间正序）
// pages[0] = 最新一页（DESC），pages[1] = 更旧一页...
// 先整体 flatMap 保持 DESC，再 reverse 得到 ASC
const serverMessages: ChatMessage[] =
  data?.pages.flatMap((p) => p.data).reverse() ?? [];
const total = data?.pages[0]?.total ?? 0;

// 合并 pending messages（排在最后 = 最新）
const allMessages: readonly (ChatMessage | PendingMessage)[] = [
  ...serverMessages,
  ...pendingMessages,
];

const listItems = buildListItems(allMessages, isSending);

// 仅当无消息且无 pending 时添加欢迎消息
if (total === 0 && pendingMessages.length === 0) {
  listItems.push({ type: 'message', data: WELCOME_MESSAGE });
}
```

> 注意 `buildListItems` 的签名需要接受 `readonly (ChatMessage | PendingMessage)[]`，因为 `PendingMessage extends ChatMessage`，这是类型兼容的。

- [ ] **Step 3: FlatList 接入无限滚动**

```typescript
<FlatList
  data={listItems}
  inverted
  keyExtractor={itemKey}
  renderItem={renderItem}
  contentContainerStyle={styles.listContent}
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
  onEndReached={() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }}
  onEndReachedThreshold={0.3}
  ListFooterComponent={
    isFetchingNextPage ? (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.sage} />
      </View>
    ) : null
  }
/>
```

> `ListFooterComponent` 在 inverted list 中显示在视觉顶部（加载更多位置）。
> 需要 `import { ActivityIndicator } from 'react-native'`。

- [ ] **Step 4: renderItem 传入删除和重试回调**

```typescript
function renderItem({ item }: { item: ListItem }) {
  if (item.type === 'separator') {
    return <DateSeparator label={item.label} />;
  }
  if (item.type === 'typing') {
    return (
      <View style={styles.typingWrapper}>
        <TypingIndicator />
      </View>
    );
  }
  const msg = item.data;
  const pendingStatus = 'status' in msg ? (msg as PendingMessage).status : undefined;

  return (
    <View style={styles.bubbleWrapper}>
      <ChatBubble
        message={msg}
        status={pendingStatus}
        onDelete={() => deleteMutation.mutate(msg.id)}
        onRetry={pendingStatus === 'failed' ? () => {
          const pm = msg as PendingMessage;
          useChatStore.getState().removePending(pm.clientId);
          if (pm.content_type === 'text') sendText(pm.content);
          else if (pm.content_type === 'image') sendOcr(pm.content);
          else if (pm.content_type === 'audio') sendAsr(pm.content);
        } : undefined}
      />
    </View>
  );
}
```

> 重试逻辑需要从 `useChat` 获取 `sendText` / `sendOcr` / `sendAsr`，根据 `content_type` 分发。

- [ ] **Step 5: `···` 按钮接清空功能**

```typescript
<TouchableOpacity
  style={styles.iconBtn}
  activeOpacity={0.75}
  onPress={() => {
    Alert.alert("清空聊天记录", "确定要删除所有聊天记录吗？此操作不可恢复。", [
      { text: "取消", style: "cancel" },
      { text: "清空", style: "destructive", onPress: () => clearMutation.mutate() },
    ]);
  }}
>
  <Text style={styles.moreIcon}>···</Text>
</TouchableOpacity>
```

- [ ] **Step 6: 移除旧的 welcome message useEffect**

删除这段代码：
```typescript
// 删除整个 useEffect
useEffect(() => {
  if (!hasInitialized.current) {
    hasInitialized.current = true;
    if (messages.length === 0) {
      addMessage(WELCOME_MESSAGE);
    }
  }
}, []);
```

以及 `hasInitialized` ref 声明。欢迎消息现在通过 `listItems` 的条件判断展示。

- [ ] **Step 7: 添加新样式**

```typescript
loadingMore: {
  paddingVertical: spacing.lg,
  alignItems: 'center',
},
```

- [ ] **Step 8: 验证编译**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: PASS（所有引用错误应已修复）

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/app/index.tsx
git commit -m "feat(mobile): integrate chat history loading, infinite scroll, and clear"
```

---

## Task 10: 端到端验证

- [ ] **Step 1: 启动 API 服务**

Run: `cd apps/api && pnpm dev`

- [ ] **Step 2: 启动移动端**

Run: `cd apps/mobile && pnpm start`

- [ ] **Step 3: 验证核心流程**

在 Expo Go 或模拟器中测试：

1. **历史加载**：打开聊天页 → 应看到之前保存的聊天记录（不是空白 + 欢迎消息）
2. **无限滚动**：向上滚动 → 应触发加载更多，顶部出现 spinner
3. **发送消息**：发送文字 → 应看到 pending 状态 → 成功后消息正式显示
4. **发送失败**：断网后发送 → 应看到红色感叹号 → 点击重试
5. **删除单条**：长按任意消息 → 弹出删除确认 → 确认后消息消失
6. **清空全部**：点击 `···` → 清空 → 聊天记录清空，显示欢迎消息
7. **离线缓存**：杀掉 app → 断网 → 重新打开 → 应看到缓存的聊天记录
8. **日记页缓存**：打开日记页加载数据 → 杀掉 app → 断网 → 重新打开日记页 → 应看到缓存的交易列表

- [ ] **Step 4: 最终 Commit**

如果验证中有修复，提交修复：
```bash
git add -A
git commit -m "fix(mobile): address issues found in e2e verification"
```

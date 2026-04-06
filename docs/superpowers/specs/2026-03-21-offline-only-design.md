# 纯离线优先架构设计

> 日期: 2026-03-21
> 状态: Draft
> 前序: 替代 2026-03-20-offline-first-design.md 的混合方案

## 1. 背景与动机

之前的混合方案（部分走本地队列、部分走 BFF）导致大量集成 bug：聊天消息顺序错乱、chatStore API 不兼容、Modal 关闭延迟等。根本原因是两套数据流（本地 vs 远程）交织太复杂。

**新方向**: SQLite 是唯一数据源。所有读写操作直接走本地 SQLite。后端同步作为未来独立 feature，本次不实现。

## 2. 设计决策

| 决策点 | 结论 |
|--------|------|
| 数据源 | SQLite 是唯一数据源，不读 Supabase |
| 离线范围 | 完整离线 app（交易、聊天、统计、预算、分类） |
| 本地 schema | 镜像 Supabase 表结构 |
| ASR/OCR/GLM | 保留按钮，离线时提示需要联网 |
| 同步 | 本次不做，未来独立 feature |
| BFF CRUD 代码 | 删除（git 历史可找回） |

## 3. 架构

```
┌─────────────────────── 移动端 ───────────────────────┐
│                                                       │
│   UI Layer (React Native)                             │
│       ↕                                               │
│   React Query (缓存层，数据来自 SQLite)                │
│       ↕                                               │
│   Local CRUD Hooks (useLocalTransactions 等)          │
│       ↕                                               │
│   expo-sqlite (唯一数据源)                             │
│       ↕                                               │
│   Rule Engine (文字解析，纯本地)                       │
│                                                       │
│   apiFetch (仅用于 ASR/OCR/GLM，需联网)               │
│       ↓ 结果写入 SQLite                               │
└───────┼───────────────────────────────────────────────┘
        ↓ (仅 ASR/OCR/GLM)
   Next.js BFF → 腾讯云/GLM
```

## 4. SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  is_default INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  category_id TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  note TEXT DEFAULT '',
  occurred_at TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  raw_input TEXT,
  receipt_url TEXT,
  ai_confidence REAL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  category_id TEXT,
  amount REAL NOT NULL,
  period TEXT NOT NULL CHECK(period IN ('weekly', 'monthly', 'yearly')),
  start_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content_type TEXT NOT NULL,
  content TEXT NOT NULL,
  transaction_id TEXT,
  created_at TEXT NOT NULL
);
```

启动时用 seed data 初始化 12 个默认分类（与 supabase/seed.sql 一致）。

## 5. 数据流

### 手动记账
```
表单提交 → 写 SQLite transactions + chat_messages → UI 刷新
全同步，零延迟
```

### 文字记账（规则命中）
```
输入 → Rule Engine 匹配 → 写 SQLite transactions + chat_messages → UI 刷新
全同步，零延迟
```

### 文字记账（规则未命中）
```
在线: 输入 → BFF /api/record/text (GLM) → 返回结果 → 写 SQLite → UI 刷新
离线: 提示"当前离线，请使用手动记账"
```

### ASR/OCR
```
在线: 录音/拍照 → BFF ASR/OCR → 文字 → Rule Engine/GLM → 写 SQLite → UI 刷新
离线: 提示"需要联网才能使用"
```

### 删除/编辑
```
操作 → 直接改 SQLite → UI 刷新
全同步，零延迟
```

### 统计
```
查询 → SQLite 聚合查询 → UI 展示
全本地，零延迟
```

## 6. 模块变更

### 新增
| 文件 | 职责 |
|------|------|
| `lib/db/schema.ts` | 建表 SQL + 初始化函数 |
| `lib/db/seed.ts` | 默认分类 seed data |
| `lib/db/index.ts` | db 实例管理 |
| `hooks/useLocalTransactions.ts` | 交易 CRUD（读写 SQLite） |
| `hooks/useLocalCategories.ts` | 分类读取（SQLite） |
| `hooks/useLocalBudgets.ts` | 预算 CRUD（SQLite） |
| `hooks/useLocalChatMessages.ts` | 聊天消息读写（SQLite） |

### 修改
| 文件 | 改动 |
|------|------|
| `app/_layout.tsx` | 初始化 SQLite，提供 db context |
| `components/ManualEntryForm.tsx` | 直接写 SQLite，同步写 chat_messages |
| `hooks/useChat.ts` | 聊天消息写 SQLite，ASR/OCR/GLM 结果也写 SQLite |
| `app/index.tsx` | 聊天列表从 SQLite 读取 |
| `app/(tabs)/bills.tsx` | 账单从 SQLite 读取 |
| `app/(tabs)/stats.tsx` | 统计从 SQLite 查询 |

### 删除
| 文件 | 原因 |
|------|------|
| `hooks/useOfflineQueue.ts` | 不需要操作队列 |
| `hooks/useSync.ts` | 不做同步 |
| `hooks/useTransactions.ts` | 被 useLocalTransactions 替代 |
| `hooks/useCategories.ts` | 被 useLocalCategories 替代 |
| `hooks/useBudgets.ts` | 被 useLocalBudgets 替代 |
| `hooks/useChatMessages.ts` | 被 useLocalChatMessages 替代 |
| `hooks/useDeleteChatMessage.ts` | 合并到 useLocalChatMessages |
| `lib/sync/sync-manager.ts` | 不做同步 |
| `lib/offline-context.ts` | 简化到 lib/db/index.ts |
| `lib/queue/operation-queue.ts` | 保留文件但不使用 |
| `components/shared/SyncIndicator.tsx` | 不做同步 |
| `store/chatStore.ts` | 不需要 Zustand 管聊天状态，SQLite 是唯一源 |

### 保留不变
| 文件 | 原因 |
|------|------|
| `lib/rule-engine/*` | 纯本地逻辑，直接复用 |
| `lib/api.ts` | ASR/OCR/GLM 仍需要 apiFetch |
| `lib/supabase.ts` | 认证仍需要 |
| `apps/api/*` | 不改 BFF，客户端不调 CRUD 端点而已 |

## 7. 关键设计原则

1. **SQLite 是唯一数据源** — UI 只读写 SQLite，不读 Supabase
2. **同步写入** — 写 SQLite 是同步操作（通过 `db.runSync` 或 await `db.runAsync`），写完即刷新 UI，无需乐观更新
3. **聊天消息和交易一起写** — 手动记账/规则命中时，在同一个函数里依次写 transactions 和 chat_messages，保证顺序
4. **React Query 仍用于缓存** — queryFn 改为读 SQLite 而不是 API 调用，invalidateQueries 触发重新读取
5. **无 Zustand** — 聊天消息不再用 chatStore 管理（这是之前 bug 的根源之一），全部走 SQLite + React Query

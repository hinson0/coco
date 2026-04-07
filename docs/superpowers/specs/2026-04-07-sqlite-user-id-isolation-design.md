# SQLite 多用户数据隔离设计

> 日期：2026-04-07
> 状态：approved

## 问题

所有本地 SQLite 数据（账单、聊天、预算、账户、分类）的 `user_id` 字段始终写入 NULL，查询也无 user_id 过滤。不同用户在同一设备登录后看到的是同一份数据。

## 目标

- 所有 INSERT 带上当前登录用户的 user_id
- 所有 SELECT 按 user_id 过滤，用户只能看到自己的数据
- 退出登录不清空数据，下次同一账号登录数据仍在
- 现有 `user_id = NULL` 的旧数据自动归属给首次登录的用户

## 方案：扩展 OfflineContext 注入 userId

### 1. OfflineContext 加 userId

`apps/mobile/lib/offline-context.ts`：context value 新增 `userId: string | null`。

```typescript
export const OfflineContext = createContext<{
  db: SQLiteDatabase | null;
  userId: string | null;
}>({ db: null, userId: null });
```

### 2. _layout.tsx 注入 userId

`apps/mobile/app/_layout.tsx`：`AppContent` 中从 `useAuth()` 取 `user.id`，传入 `OfflineContext.Provider`。

```tsx
const { isAuthenticated, user, loading } = useAuth();
// ...
<OfflineContext.Provider value={{ db, userId: user?.id ?? null }}>
```

### 3. 旧数据迁移

新增迁移函数 `migrateNullUserData(db, userId)`，在用户首次登录且 db 初始化后执行：

```sql
UPDATE transactions SET user_id = ? WHERE user_id IS NULL;
UPDATE chat_messages SET user_id = ? WHERE user_id IS NULL;
UPDATE accounts SET user_id = ? WHERE user_id IS NULL;
UPDATE budgets SET user_id = ? WHERE user_id IS NULL;
-- 只迁移用户自建分类，系统默认分类保持 NULL
UPDATE categories SET user_id = ? WHERE user_id IS NULL AND is_default = 0;
```

触发时机：`_layout.tsx` 中 `useEffect` 监听 `user?.id` 变化，当 db 和 userId 都就绪时执行。无需 flag 防重复 — SQL 本身幂等（`WHERE user_id IS NULL` 在无 NULL 数据时影响 0 行）。

### 4. 各 Hook 改动

**通用模式**：每个 hook 通过 `useOfflineDb()` 获取 `{ db, userId }`。

#### useLocalTransactions.ts
- INSERT：`user_id` 从 NULL 改为 `userId`
- SELECT：加 `WHERE user_id = ? AND deleted_at IS NULL`

#### useLocalChatMessages.ts
- INSERT：`user_id` 从 NULL 改为 `userId`
- SELECT：加 `WHERE user_id = ?`
- DELETE（清空）：加 `WHERE user_id = ?`

#### useLocalAccounts.ts
- INSERT：`user_id` 从 NULL 改为 `userId`
- SELECT：加 `WHERE user_id = ? AND deleted_at IS NULL`

#### useLocalBudgets.ts
- INSERT：`user_id` 从 NULL 改为 `userId`
- SELECT：加 `WHERE user_id = ?`

#### useLocalCategories.ts
- INSERT（用户自建）：`user_id` 设为 `userId`
- SELECT：`WHERE (user_id = ? OR (user_id IS NULL AND is_default = 1)) AND deleted_at IS NULL`
- 系统默认分类（seed）保持 `user_id = NULL`，所有用户共享

#### useChat.ts
- `createTransaction` 调用时传入 userId（从 context 获取）

### 5. useOfflineDb hook 更新

当前 `useOfflineDb()` 返回 `db`，改为返回 `{ db, userId }`。所有消费方解构更新。

## 不改动的部分

- 后端 PostgreSQL 和 API 层不涉及
- 退出登录逻辑不变（不清空 SQLite）
- 数据库文件名保持 `coco.db`（单文件，通过 user_id 列隔离）
- seed 默认分类保持 `user_id = NULL`

## 影响范围

| 文件 | 改动类型 |
|------|---------|
| `lib/offline-context.ts` | 加 userId 字段 |
| `app/_layout.tsx` | 注入 userId + 迁移调用 |
| `lib/db/index.ts` | 新增 migrateNullUserData |
| `hooks/useLocalTransactions.ts` | INSERT/SELECT 加 userId |
| `hooks/useLocalChatMessages.ts` | INSERT/SELECT/DELETE 加 userId |
| `hooks/useLocalAccounts.ts` | INSERT/SELECT 加 userId |
| `hooks/useLocalBudgets.ts` | INSERT/SELECT 加 userId |
| `hooks/useLocalCategories.ts` | INSERT 加 userId，SELECT 加 OR 逻辑 |
| `hooks/useChat.ts` | createTransaction 传 userId |

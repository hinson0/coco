# SQLite 多用户数据隔离 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让所有本地 SQLite 数据按 user_id 隔离，不同用户只能看到自己的数据

**Architecture:** 扩展 OfflineContext 注入 userId，所有 INSERT 带 userId，所有 SELECT 加 WHERE user_id 过滤，旧 NULL 数据自动归属首次登录用户

**Tech Stack:** React Native, expo-sqlite, React Context

---

## Task 1：扩展 OfflineContext + 添加 user_id 索引

**Files:**
- Modify: `apps/mobile/lib/offline-context.ts`
- Modify: `apps/mobile/lib/db/schema.ts:94-118`

- [ ] **Step 1: 修改 OfflineContext 添加 userId 字段**

```typescript
// apps/mobile/lib/offline-context.ts
import { createContext, useContext } from "react";
import type * as SQLite from "expo-sqlite";

interface OfflineContextValue {
  readonly db: SQLite.SQLiteDatabase | null;
  readonly userId: string | null;
}

export const OfflineContext = createContext<OfflineContextValue>({
  db: null,
  userId: null,
});

export function useOfflineContext(): OfflineContextValue {
  return useContext(OfflineContext);
}
```

- [ ] **Step 2: 在 schema.ts 的 runMigrations 中添加 user_id 索引**

在 `runMigrations` 函数末尾添加：

```typescript
// user_id 索引（多用户数据隔离）
await db.execAsync("CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)");
await db.execAsync("CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id)");
await db.execAsync("CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)");
await db.execAsync("CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id)");
await db.execAsync("CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)");
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/offline-context.ts apps/mobile/lib/db/schema.ts
git commit -m "feat(mobile): 扩展 OfflineContext 添加 userId + user_id 索引"
```

---

## Task 2：添加 NULL 数据迁移函数 + _layout.tsx 集成

**Files:**
- Modify: `apps/mobile/lib/db/index.ts`
- Modify: `apps/mobile/app/_layout.tsx:37-86`

- [ ] **Step 1: 在 lib/db/index.ts 添加 migrateNullUserData 函数**

在 `initDatabase` 函数后面添加：

```typescript
export async function migrateNullUserData(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<void> {
  await db.runAsync("UPDATE transactions SET user_id = ? WHERE user_id IS NULL", userId);
  await db.runAsync("UPDATE chat_messages SET user_id = ? WHERE user_id IS NULL", userId);
  await db.runAsync("UPDATE accounts SET user_id = ? WHERE user_id IS NULL", userId);
  await db.runAsync("UPDATE budgets SET user_id = ? WHERE user_id IS NULL", userId);
  await db.runAsync(
    "UPDATE categories SET user_id = ? WHERE user_id IS NULL AND is_default = 0",
    userId,
  );
}
```

- [ ] **Step 2: 修改 _layout.tsx 注入 userId + 触发迁移**

`AppContent` 函数改为：

```tsx
function AppContent() {
  const { isAuthenticated, user, loading } = useAuth();
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);

  useEffect(() => {
    initDatabase().then(setDb);

    async function setupNotifications() {
      if (!Notifications) return;
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("reminder", {
            name: "记账提醒",
            importance: Notifications.AndroidImportance.HIGH,
            sound: "default",
          });
        }
        await Notifications.requestPermissionsAsync();
      } catch {}
    }
    setupNotifications();
  }, []);

  // 用户登录后，迁移 NULL 数据
  useEffect(() => {
    if (db && user?.id) {
      migrateNullUserData(db, user.id);
    }
  }, [db, user?.id]);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/(auth)/login");
  }, [isAuthenticated, loading]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F5F5F5",
        }}
      >
        <Text style={{ color: "#2D9B83", fontSize: 28, fontWeight: "800" }}>
          CoCo
        </Text>
      </View>
    );
  }

  return (
    <OfflineContext.Provider value={{ db, userId: user?.id ?? null }}>
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
    </OfflineContext.Provider>
  );
}
```

注意：需要在文件顶部添加 `migrateNullUserData` 的 import：

```typescript
import { initDatabase, migrateNullUserData } from "@/lib/db";
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/db/index.ts apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): 添加 NULL 数据迁移 + _layout 注入 userId"
```

---

## Task 3：useLocalTransactions 添加 user_id 过滤

**Files:**
- Modify: `apps/mobile/hooks/useLocalTransactions.ts`

- [ ] **Step 1: useLocalTransactions — SELECT 加 WHERE user_id**

```typescript
export function useLocalTransactions(page = 1, limit = 20) {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["transactions", page, userId],
    queryFn: async () => {
      if (!db || !userId) return { data: [] as Transaction[], total: 0, page, limit };
      const offset = (page - 1) * limit;
      const [rows, countRow] = await Promise.all([
        db.getAllAsync<Transaction>(
          "SELECT * FROM transactions WHERE user_id = ? AND deleted_at IS NULL ORDER BY occurred_at DESC LIMIT ? OFFSET ?",
          userId,
          limit,
          offset
        ),
        db.getFirstAsync<{ count: number }>(
          "SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND deleted_at IS NULL",
          userId
        ),
      ]);
      return { data: rows, total: countRow?.count ?? 0, page, limit };
    },
    enabled: !!db && !!userId,
  });
}
```

- [ ] **Step 2: useMonthlyTransactions — SELECT 加 WHERE user_id**

```typescript
export function useMonthlyTransactions(year: number, month: number, accountId?: string | null) {
  const { db, userId } = useOfflineContext();

  const startDate = new Date(year, month, 1).toISOString();
  const endDate = new Date(year, month + 1, 1).toISOString();

  return useQuery({
    queryKey: ["transactions", "monthly", `${year}-${String(month + 1).padStart(2, "0")}`, accountId ?? "all", userId],
    queryFn: async (): Promise<readonly Transaction[]> => {
      if (!db || !userId) return [];
      if (accountId) {
        return db.getAllAsync<Transaction>(
          "SELECT * FROM transactions WHERE user_id = ? AND deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ? AND account_id = ? ORDER BY occurred_at DESC",
          userId,
          startDate,
          endDate,
          accountId
        );
      }
      return db.getAllAsync<Transaction>(
        "SELECT * FROM transactions WHERE user_id = ? AND deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ? ORDER BY occurred_at DESC",
        userId,
        startDate,
        endDate
      );
    },
    enabled: !!db && !!userId,
  });
}
```

- [ ] **Step 3: useCreateTransaction — INSERT 带 userId**

将 `VALUES (?, NULL, ?, ...` 中的 `NULL` 改为 `userId`：

```typescript
export function useCreateTransaction() {
  const { db, userId } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTransactionInput): Promise<string> => {
      if (!db || !userId) throw new Error("Database not initialized");
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO transactions (id, user_id, category_id, amount, type, note, occurred_at, source, raw_input, receipt_url, ai_confidence, created_at, account_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        userId,
        input.category_id,
        input.amount,
        input.type,
        input.note,
        input.occurred_at,
        input.source ?? "manual",
        input.raw_input ?? null,
        input.receipt_url ?? null,
        input.ai_confidence ?? null,
        now,
        input.account_id ?? null
      );
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["account-balance"] });
      qc.invalidateQueries({ queryKey: ["total-assets"] });
    },
  });
}
```

- [ ] **Step 4: useUpdateTransaction 和 useDeleteTransaction 不变**

这两个函数按 `id`（主键）操作，不需要加 user_id 过滤。保持原样。

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/hooks/useLocalTransactions.ts
git commit -m "feat(mobile): useLocalTransactions INSERT/SELECT 添加 user_id"
```

---

## Task 4：useLocalChatMessages 添加 user_id 过滤

**Files:**
- Modify: `apps/mobile/hooks/useLocalChatMessages.ts`

- [ ] **Step 1: useLocalChatMessages — SELECT 加 WHERE user_id**

```typescript
export function useLocalChatMessages(limit: number = CHAT_PAGE_SIZE) {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["chat-messages", limit, userId],
    queryFn: async (): Promise<readonly ChatMessage[]> => {
      if (!db || !userId) return [];
      const rows = await db.getAllAsync<ChatMessage>(
        "SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        userId,
        limit,
      );
      return [...rows].reverse();
    },
    enabled: !!db && !!userId,
    placeholderData: keepPreviousData,
  });
}
```

- [ ] **Step 2: useAddChatMessage — INSERT 带 userId**

```typescript
export function useAddChatMessage() {
  const { db, userId } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddMessageInput): Promise<string> => {
      if (!db || !userId) throw new Error("Database not initialized");
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      await db.runAsync(
        "INSERT INTO chat_messages (id, user_id, role, content_type, content, transaction_id, created_at, audio_uri, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id,
        userId,
        input.role,
        input.content_type,
        input.content,
        input.transaction_id ?? null,
        now,
        input.audio_uri ?? null,
        input.duration_seconds ?? null,
      );
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
    },
  });
}
```

- [ ] **Step 3: useDeleteChatMessage — 不变（按 id 删除）**

保持原样，按主键操作。

- [ ] **Step 4: useClearChatMessages — DELETE 加 WHERE user_id**

```typescript
export function useClearChatMessages() {
  const { db, userId } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!db || !userId) throw new Error("Database not initialized");
      await db.runAsync("DELETE FROM chat_messages WHERE user_id = ?", userId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
    },
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/hooks/useLocalChatMessages.ts
git commit -m "feat(mobile): useLocalChatMessages INSERT/SELECT/DELETE 添加 user_id"
```

---

## Task 5：useLocalAccounts 添加 user_id 过滤

**Files:**
- Modify: `apps/mobile/hooks/useLocalAccounts.ts`

- [ ] **Step 1: useAccounts — SELECT 加 WHERE user_id**

```typescript
export function useAccounts() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["accounts", userId],
    queryFn: async (): Promise<readonly Account[]> => {
      if (!db || !userId) return [];
      return db.getAllAsync<Account>(
        "SELECT * FROM accounts WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC",
        userId
      );
    },
    enabled: !!db && !!userId,
  });
}
```

- [ ] **Step 2: useAccountBalance — 不变（按 account id 查询）**

保持原样。账户本身已经通过 useAccounts 过滤了 user_id，这里按 account id 查询是安全的。

- [ ] **Step 3: useTotalAssets — SELECT accounts 加 WHERE user_id**

```typescript
export function useTotalAssets() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["total-assets", userId],
    queryFn: async (): Promise<number> => {
      if (!db || !userId) return 0;

      const accounts = await db.getAllAsync<Account>(
        "SELECT * FROM accounts WHERE user_id = ? AND deleted_at IS NULL",
        userId
      );

      let total = 0;
      for (const account of accounts) {
        const income = await db.getFirstAsync<{ total: number }>(
          "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = 'income' AND deleted_at IS NULL",
          account.id
        );
        const expense = await db.getFirstAsync<{ total: number }>(
          "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = 'expense' AND deleted_at IS NULL",
          account.id
        );
        total += account.initial_balance + (income?.total ?? 0) - (expense?.total ?? 0);
      }
      return total;
    },
    enabled: !!db && !!userId,
  });
}
```

- [ ] **Step 4: useCreateAccount — INSERT 带 userId**

```typescript
export function useCreateAccount() {
  const { db, userId } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAccountInput) => {
      if (!db || !userId) throw new Error("Database not initialized");
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      await db.runAsync(
        "INSERT INTO accounts (id, user_id, name, icon, type, initial_balance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        id,
        userId,
        input.name,
        input.icon,
        input.type,
        input.initial_balance,
        now
      );
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["total-assets"] });
    },
  });
}
```

- [ ] **Step 5: useUpdateAccount 和 useDeleteAccount — 不变（按 id 操作）**

保持原样，按主键操作。

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/hooks/useLocalAccounts.ts
git commit -m "feat(mobile): useLocalAccounts INSERT/SELECT 添加 user_id"
```

---

## Task 6：useLocalBudgets 添加 user_id 过滤

**Files:**
- Modify: `apps/mobile/hooks/useLocalBudgets.ts`

- [ ] **Step 1: useLocalBudgets — SELECT 加 WHERE user_id**

```typescript
export function useLocalBudgets() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["budgets", userId],
    queryFn: async (): Promise<readonly Budget[]> => {
      if (!db || !userId) return [];
      return db.getAllAsync<Budget>(
        "SELECT * FROM budgets WHERE user_id = ? ORDER BY start_date DESC",
        userId
      );
    },
    enabled: !!db && !!userId,
  });
}
```

- [ ] **Step 2: useCreateBudget — INSERT 带 userId**

```typescript
export function useCreateBudget() {
  const { db, userId } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBudgetInput) => {
      if (!db || !userId) throw new Error("Database not initialized");
      const id = Crypto.randomUUID();
      await db.runAsync(
        "INSERT INTO budgets (id, user_id, category_id, amount, period, start_date) VALUES (?, ?, ?, ?, ?, ?)",
        id,
        userId,
        input.category_id,
        input.amount,
        input.period,
        input.start_date
      );
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
```

- [ ] **Step 3: useUpdateBudget 和 useDeleteBudget — 不变（按 id 操作）**

保持原样。

- [ ] **Step 4: useGlobalBudget — SELECT 加 WHERE user_id**

```typescript
export function useGlobalBudget() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["budgets", "global", userId],
    queryFn: async (): Promise<Budget | null> => {
      if (!db || !userId) return null;
      return db.getFirstAsync<Budget>(
        "SELECT * FROM budgets WHERE user_id = ? AND category_id IS NULL AND period = 'monthly' ORDER BY start_date DESC LIMIT 1",
        userId
      );
    },
    enabled: !!db && !!userId,
  });
}
```

- [ ] **Step 5: useCategoryBudgets — SELECT 加 WHERE user_id**

```typescript
export function useCategoryBudgets() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["budgets", "category", userId],
    queryFn: async (): Promise<readonly Budget[]> => {
      if (!db || !userId) return [];
      return db.getAllAsync<Budget>(
        "SELECT * FROM budgets WHERE user_id = ? AND category_id IS NOT NULL AND period = 'monthly' ORDER BY start_date DESC",
        userId
      );
    },
    enabled: !!db && !!userId,
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/hooks/useLocalBudgets.ts
git commit -m "feat(mobile): useLocalBudgets INSERT/SELECT 添加 user_id"
```

---

## Task 7：useLocalCategories 添加 user_id 过滤（含 OR 逻辑）

**Files:**
- Modify: `apps/mobile/hooks/useLocalCategories.ts`

- [ ] **Step 1: useLocalCategories — SELECT 加 OR 逻辑**

系统默认分类（`is_default = 1, user_id IS NULL`）对所有用户可见，用户自建分类按 user_id 过滤：

```typescript
export function useLocalCategories() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["categories", userId],
    queryFn: async (): Promise<readonly Category[]> => {
      if (!db || !userId) return [];
      const rows = await db.getAllAsync<Category>(
        "SELECT * FROM categories WHERE deleted_at IS NULL AND (user_id = ? OR (user_id IS NULL AND is_default = 1)) ORDER BY type, name",
        userId
      );
      return rows.map((r) => ({ ...r, is_default: Boolean(r.is_default) }));
    },
    enabled: !!db && !!userId,
  });
}
```

- [ ] **Step 2: useCreateCategory — INSERT 带 userId**

```typescript
export function useCreateCategory() {
  const { db, userId } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      if (!db || !userId) throw new Error("Database not initialized");
      const id = Crypto.randomUUID();
      await db.runAsync(
        "INSERT INTO categories (id, user_id, name, icon, type, is_default) VALUES (?, ?, ?, ?, ?, 0)",
        id,
        userId,
        input.name,
        input.icon,
        input.type
      );
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
```

- [ ] **Step 3: useUpdateCategory 和 useDeleteCategory — 不变（按 id 操作）**

保持原样。

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/hooks/useLocalCategories.ts
git commit -m "feat(mobile): useLocalCategories INSERT/SELECT 添加 user_id（含 OR 逻辑）"
```

---

## Task 8：页面级直接 SQL 查询添加 user_id 过滤

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx:18-50`
- Modify: `apps/mobile/app/(tabs)/bills.tsx:95-116`
- Modify: `apps/mobile/app/budget-months-detail.tsx:16-33`
- Modify: `apps/mobile/app/streak-detail.tsx:17-44`
- Modify: `apps/mobile/components/profile/ExportSheet.tsx:98-125`

这些文件直接用 `db` 执行 SQL 查询 transactions/budgets，需要加 user_id 过滤。

- [ ] **Step 1: profile.tsx — useProfileStats 加 user_id**

```typescript
function useProfileStats() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["transactions", "stats", userId],
    queryFn: async () => {
      if (!db || !userId) return { monthlyCount: 0, streak: 0, budgetMonths: 0 };

      const now = new Date();
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString();
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
      ).toISOString();

      const [monthlyRow, budgetRow, dayRows] = await Promise.all([
        db.getFirstAsync<{ count: number }>(
          "SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ?",
          userId,
          monthStart,
          monthEnd,
        ),
        db.getFirstAsync<{ count: number }>(
          "SELECT COUNT(DISTINCT strftime('%Y-%m', occurred_at)) as count FROM transactions WHERE user_id = ? AND deleted_at IS NULL",
          userId,
        ),
        db.getAllAsync<{ day: string }>(
          "SELECT DISTINCT date(occurred_at) as day FROM transactions WHERE user_id = ? AND deleted_at IS NULL ORDER BY day DESC",
          userId,
        ),
      ]);

      // 计算连续记账天数（后续代码不变）
```

- [ ] **Step 2: bills.tsx — useCurrentMonthStats 加 user_id**

```typescript
function useCurrentMonthStats(categoryId?: string) {
  const { db, userId } = useOfflineContext();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  return useQuery({
    queryKey: ['transactions', 'month-stats', categoryId ?? 'all', userId],
    queryFn: async () => {
      if (!db || !userId) return { count: 0, expense: 0 };
      const catFilter = categoryId ? ' AND category_id = ?' : '';
      const params: (string | number)[] = [userId, monthStart, monthEnd];
      if (categoryId) params.push(categoryId);
      const row = await db.getFirstAsync<{ count: number; expense: number }>(
        `SELECT COUNT(*) as count, COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense FROM transactions WHERE user_id = ? AND deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ?${catFilter}`,
        ...params
      );
      return { count: row?.count ?? 0, expense: row?.expense ?? 0 };
    },
    enabled: !!db && !!userId,
  });
}
```

- [ ] **Step 3: budget-months-detail.tsx — useBudgetMonthsDetail 加 user_id**

```typescript
function useBudgetMonthsDetail() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["transactions", "budget-months-detail", userId],
    queryFn: async () => {
      if (!db || !userId)
        return { total: 0, months: [] as { month: string; count: number }[] };

      const rows = await db.getAllAsync<{ month: string; count: number }>(
        "SELECT strftime('%Y-%m', occurred_at) as month, COUNT(*) as count FROM transactions WHERE user_id = ? AND deleted_at IS NULL GROUP BY month ORDER BY month DESC",
        userId,
      );

      return { total: rows.length, months: rows };
    },
    enabled: !!db && !!userId,
  });
}
```

- [ ] **Step 4: streak-detail.tsx — useStreakDetail 加 user_id**

```typescript
function useStreakDetail() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["transactions", "streak-detail", userId],
    queryFn: async () => {
      if (!db || !userId)
        return {
          streak: 0,
          recentDays: [] as { day: string; count: number }[],
        };

      const dayRows = await db.getAllAsync<{ day: string; count: number }>(
        "SELECT date(occurred_at) as day, COUNT(*) as count FROM transactions WHERE user_id = ? AND deleted_at IS NULL GROUP BY day ORDER BY day DESC LIMIT 30",
        userId,
      );

      // 后续 streak 计算逻辑不变
```

- [ ] **Step 5: ExportSheet.tsx — handleExport 加 user_id**

```typescript
export function ExportSheet({ visible, onClose }: ExportSheetProps) {
  const { db, userId } = useOfflineContext();
  const insets = useSafeAreaInsets();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!db || !userId) return;
    setExporting(true);
    try {
      const rows = await db.getAllAsync<ExportRow>(
        `SELECT
          t.occurred_at,
          t.type,
          c.name AS category_name,
          c.icon AS category_icon,
          t.amount,
          t.note,
          t.source,
          a.name AS account_name,
          t.raw_input,
          t.ai_confidence,
          t.created_at
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.user_id = ? AND t.deleted_at IS NULL
        ORDER BY t.occurred_at DESC`,
        userId,
      );
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/\(tabs\)/profile.tsx apps/mobile/app/\(tabs\)/bills.tsx apps/mobile/app/budget-months-detail.tsx apps/mobile/app/streak-detail.tsx apps/mobile/components/profile/ExportSheet.tsx
git commit -m "feat(mobile): 页面级直接 SQL 查询添加 user_id 过滤"
```

---

## Task 9：useChat 更新解构

**Files:**
- Modify: `apps/mobile/hooks/useChat.ts:41`

- [ ] **Step 1: 更新 useOfflineContext 解构**

`useChat` 只用 `db` 做 ASR 文本更新（`UPDATE ... WHERE id = ?`），不需要 user_id。但因为 context 接口变了，解构需要更新（虽然 `{ db }` 在 TypeScript 中仍然合法，为清晰起见保持一致）：

实际上 `const { db } = useOfflineContext()` 在接口扩展后仍然正常工作，无需改动。跳过此 Task。

---

## 验证清单

完成全部 Task 后，手动验证：

1. 用户 A 登录 → 创建账单 → 检查 SQLite 中 `user_id` 是否为 A 的 id
2. 用户 A 退出 → 用户 B 登录 → 确认看不到 A 的账单、聊天、预算
3. 用户 B 退出 → 用户 A 重新登录 → 确认 A 的数据仍在
4. 导出 CSV → 确认只导出当前用户的数据

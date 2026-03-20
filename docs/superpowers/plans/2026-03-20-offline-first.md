# Offline-First 离线优先架构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 CoCo AI 记账应用的创建/删除交易操作即时响应（<50ms），通过本地操作队列 + 后台同步实现离线优先。

**Architecture:** 新增三个本地模块（Operation Queue、Rule Engine、SyncManager），全部在 `apps/mobile/` 内。React Query 仍为 UI 数据源，expo-sqlite 存储操作队列，乐观更新让 UI 即时响应，SyncManager 后台重放到现有 BFF API。BFF 零改动。

**Tech Stack:** expo-sqlite, @react-native-community/netinfo, React Query (existing), Zustand (existing), uuid

**Spec:** `docs/superpowers/specs/2026-03-20-offline-first-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `apps/mobile/lib/queue/operation-queue.ts` | SQLite 队列 CRUD（init, enqueue, getPending, markSyncing, markPending, markFailed, remove, exists, updatePayload, markFailedByDependency） |
| `apps/mobile/lib/rule-engine/extract-amount.ts` | 从文本提取金额 **TODO (human)** |
| `apps/mobile/lib/rule-engine/match-category.ts` | 关键词匹配分类 **TODO (human)** |
| `apps/mobile/lib/rule-engine/keywords.ts` | 分类关键词映射表 **TODO (human)** |
| `apps/mobile/lib/rule-engine/index.ts` | 规则引擎入口 parse(text) |
| `apps/mobile/lib/sync/sync-manager.ts` | 核心同步逻辑（sync, 依赖检查, 级联失败） |
| `apps/mobile/hooks/useSync.ts` | Hook: 监听网络/AppState，触发 sync |
| `apps/mobile/hooks/useOfflineQueue.ts` | Hook: enqueue/delete 操作 + 乐观更新 **TODO (human)** |
| `apps/mobile/__tests__/lib/queue/operation-queue.test.ts` | 队列单元测试 |
| `apps/mobile/__tests__/lib/rule-engine/extract-amount.test.ts` | 金额提取测试 **TODO (human)** |
| `apps/mobile/__tests__/lib/rule-engine/match-category.test.ts` | 分类匹配测试 **TODO (human)** |
| `apps/mobile/__tests__/lib/rule-engine/index.test.ts` | 规则引擎集成测试 |
| `apps/mobile/__tests__/lib/sync/sync-manager.test.ts` | 同步管理器测试 |

### Modified Files

| File | Change |
|------|--------|
| `apps/mobile/package.json` | 添加 expo-sqlite, @react-native-community/netinfo, uuid |
| `apps/mobile/app/_layout.tsx` | 初始化 SQLite + SyncManager |
| `apps/mobile/components/ManualEntryForm.tsx` | 改用 useOfflineQueue.enqueueCreate 替代直接 API 调用 |
| `apps/mobile/hooks/useChat.ts` | 文字记账路径加入规则引擎前置拦截 |
| `apps/mobile/hooks/useTransactions.ts` | 添加 useDeleteTransaction 的乐观删除 + 队列集成 |

---

## Task 1: 安装依赖

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: 安装 expo-sqlite**

```bash
cd apps/mobile && npx expo install expo-sqlite
```

- [ ] **Step 2: 安装 netinfo**

```bash
cd apps/mobile && npx expo install @react-native-community/netinfo
```

- [ ] **Step 3: 安装 uuid**

```bash
cd apps/mobile && npm install uuid && npm install -D @types/uuid
```

- [ ] **Step 4: 验证安装**

```bash
cd apps/mobile && cat package.json | grep -E "expo-sqlite|netinfo|uuid"
```
Expected: 三个包都在 dependencies 中。

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "chore: add expo-sqlite, netinfo, uuid for offline-first"
```

---

## Task 2: Operation Queue — SQLite CRUD

**Files:**
- Create: `apps/mobile/lib/queue/operation-queue.ts`
- Test: `apps/mobile/__tests__/lib/queue/operation-queue.test.ts`

> **学习点**: 这是整个离线架构的基石。Operation Queue 本质上是一个持久化的 FIFO 消息队列，和 RabbitMQ/Kafka 的核心概念一样——只不过跑在本地 SQLite 里。

- [ ] **Step 1: 写测试 — 初始化和基础 CRUD**

```typescript
// apps/mobile/__tests__/lib/queue/operation-queue.test.ts
import * as SQLite from "expo-sqlite";
import {
  initQueue,
  enqueue,
  getPending,
  remove,
  getCount,
} from "@/lib/queue/operation-queue";

// expo-sqlite 在测试环境中使用内存数据库
let db: SQLite.SQLiteDatabase;

beforeEach(async () => {
  db = await SQLite.openDatabaseAsync(":memory:");
  await initQueue(db);
});

afterEach(async () => {
  await db.closeAsync();
});

describe("operation-queue", () => {
  it("should initialize the table without error", async () => {
    const count = await getCount(db);
    expect(count).toBe(0);
  });

  it("should enqueue a create_transaction operation", async () => {
    await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 25, category_id: "cat_1", note: "午饭" },
    });
    const pending = await getPending(db);
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe("create_transaction");
    expect(JSON.parse(pending[0].payload).amount).toBe(25);
    expect(pending[0].status).toBe("pending");
  });

  it("should return pending ops in created_at order", async () => {
    await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 10, note: "first" },
    });
    await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 20, note: "second" },
    });
    const pending = await getPending(db);
    expect(JSON.parse(pending[0].payload).note).toBe("first");
    expect(JSON.parse(pending[1].payload).note).toBe("second");
  });

  it("should remove an operation by id", async () => {
    await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 25 },
    });
    const [op] = await getPending(db);
    await remove(db, op.id);
    expect(await getCount(db)).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/mobile && npx jest __tests__/lib/queue/operation-queue.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/queue/operation-queue'`

- [ ] **Step 3: 实现 operation-queue.ts**

```typescript
// apps/mobile/lib/queue/operation-queue.ts
import * as SQLite from "expo-sqlite";
import { v4 as uuid } from "uuid";

export interface QueueOperation {
  readonly id: string;
  readonly type: "create_transaction" | "delete_transaction";
  readonly payload: string; // JSON
  readonly status: "pending" | "syncing" | "failed";
  readonly retries: number;
  readonly created_at: number;
  readonly depends_on: string | null;
  readonly error: string | null;
}

export interface EnqueueParams {
  readonly type: QueueOperation["type"];
  readonly payload: Record<string, unknown>;
  readonly dependsOn?: string;
}

export async function initQueue(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS operation_queue (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      payload     TEXT NOT NULL,
      status      TEXT DEFAULT 'pending',
      retries     INTEGER DEFAULT 0,
      created_at  INTEGER NOT NULL,
      depends_on  TEXT,
      error       TEXT
    );
  `);
}

export async function enqueue(
  db: SQLite.SQLiteDatabase,
  params: EnqueueParams
): Promise<string> {
  const id = uuid();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO operation_queue (id, type, payload, status, retries, created_at, depends_on)
     VALUES (?, ?, ?, 'pending', 0, ?, ?)`,
    id,
    params.type,
    JSON.stringify(params.payload),
    now,
    params.dependsOn ?? null
  );
  return id;
}

export async function getPending(
  db: SQLite.SQLiteDatabase
): Promise<readonly QueueOperation[]> {
  return db.getAllAsync<QueueOperation>(
    `SELECT * FROM operation_queue WHERE status = 'pending' ORDER BY created_at ASC`
  );
}

export async function remove(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync(`DELETE FROM operation_queue WHERE id = ?`, id);
}

export async function getCount(
  db: SQLite.SQLiteDatabase
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM operation_queue`
  );
  return row?.count ?? 0;
}

export async function markSyncing(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync(
    `UPDATE operation_queue SET status = 'syncing' WHERE id = ?`,
    id
  );
}

export async function markPending(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync(
    `UPDATE operation_queue SET status = 'pending' WHERE id = ?`,
    id
  );
}

export async function markFailed(
  db: SQLite.SQLiteDatabase,
  id: string,
  error: string
): Promise<void> {
  await db.runAsync(
    `UPDATE operation_queue SET status = 'failed', retries = retries + 1, error = ? WHERE id = ?`,
    error,
    id
  );
}

export async function exists(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM operation_queue WHERE id = ?`,
    id
  );
  return (row?.count ?? 0) > 0;
}

export async function updatePayload(
  db: SQLite.SQLiteDatabase,
  id: string,
  payload: Record<string, unknown>
): Promise<void> {
  await db.runAsync(
    `UPDATE operation_queue SET payload = ? WHERE id = ?`,
    JSON.stringify(payload),
    id
  );
}

export async function markFailedByDependency(
  db: SQLite.SQLiteDatabase,
  dependsOnId: string
): Promise<void> {
  await db.runAsync(
    `UPDATE operation_queue SET status = 'failed', error = 'dependency_failed' WHERE depends_on = ?`,
    dependsOnId
  );
}

export async function resetSyncingToPending(
  db: SQLite.SQLiteDatabase
): Promise<void> {
  await db.runAsync(
    `UPDATE operation_queue SET status = 'pending' WHERE status = 'syncing'`
  );
}

export async function findByTempId(
  db: SQLite.SQLiteDatabase,
  tempId: string
): Promise<QueueOperation | null> {
  return db.getFirstAsync<QueueOperation>(
    `SELECT * FROM operation_queue WHERE type = 'create_transaction' AND payload LIKE ?`,
    `%${tempId}%`
  );
}

export async function getDependents(
  db: SQLite.SQLiteDatabase,
  operationId: string
): Promise<readonly QueueOperation[]> {
  return db.getAllAsync<QueueOperation>(
    `SELECT * FROM operation_queue WHERE depends_on = ?`,
    operationId
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd apps/mobile && npx jest __tests__/lib/queue/operation-queue.test.ts
```
Expected: PASS — 4 tests passed

- [ ] **Step 5: 写测试 — 状态管理和依赖**

```typescript
// 追加到 apps/mobile/__tests__/lib/queue/operation-queue.test.ts

describe("status transitions", () => {
  it("should mark operation as syncing", async () => {
    await enqueue(db, { type: "create_transaction", payload: { amount: 10 } });
    const [op] = await getPending(db);
    await markSyncing(db, op.id);
    const pending = await getPending(db);
    expect(pending).toHaveLength(0); // no longer pending
  });

  it("should mark syncing back to pending", async () => {
    await enqueue(db, { type: "create_transaction", payload: { amount: 10 } });
    const [op] = await getPending(db);
    await markSyncing(db, op.id);
    await markPending(db, op.id);
    expect(await getPending(db)).toHaveLength(1);
  });

  it("should reset all syncing to pending on startup", async () => {
    await enqueue(db, { type: "create_transaction", payload: { amount: 10 } });
    await enqueue(db, { type: "create_transaction", payload: { amount: 20 } });
    const ops = await getPending(db);
    await markSyncing(db, ops[0].id);
    await markSyncing(db, ops[1].id);
    await resetSyncingToPending(db);
    expect(await getPending(db)).toHaveLength(2);
  });
});

describe("depends_on", () => {
  it("should enqueue with dependency", async () => {
    const createId = await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 10 },
    });
    await enqueue(db, {
      type: "delete_transaction",
      payload: { id: "temp_123" },
      dependsOn: createId,
    });
    const pending = await getPending(db);
    expect(pending[1].depends_on).toBe(createId);
  });

  it("should cascade failure to dependents", async () => {
    const createId = await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 10 },
    });
    await enqueue(db, {
      type: "delete_transaction",
      payload: { id: "temp_123" },
      dependsOn: createId,
    });
    await markFailed(db, createId, "server error");
    await markFailedByDependency(db, createId);

    const pending = await getPending(db);
    expect(pending).toHaveLength(0); // both failed, none pending
  });
});
```

- [ ] **Step 6: 运行全部队列测试**

```bash
cd apps/mobile && npx jest __tests__/lib/queue/operation-queue.test.ts
```
Expected: PASS — all tests

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/lib/queue/ apps/mobile/__tests__/lib/queue/
git commit -m "feat: add operation queue with SQLite storage and dependency tracking"
```

---

## Task 3: Rule Engine — 金额提取 (TODO human)

**Files:**
- Create: `apps/mobile/lib/rule-engine/extract-amount.ts` **TODO (human)**
- Test: `apps/mobile/__tests__/lib/rule-engine/extract-amount.test.ts` **TODO (human)**

> **学习模式**: 这个 task 由你来完成。我先给你测试用例的框架，你来写测试和实现。
>
> **TDD 提示**: 正则表达式是典型的"看起来简单写起来坑多"的场景。先从最简单的 case 开始（"25元"），逐步加入边界 case（"15.5"、"¥100"、纯数字、多个数字）。每加一个 case，先写测试看它 fail，再改正则让它 pass。

- [ ] **Step 1: 你来写失败测试**

Claude 提供的测试框架（你可以修改/扩展）：

```typescript
// apps/mobile/__tests__/lib/rule-engine/extract-amount.test.ts
import { extractAmount } from "@/lib/rule-engine/extract-amount";

describe("extractAmount", () => {
  // 基础 case
  it("提取 '午饭25元' → 25", () => {
    expect(extractAmount("午饭25元")).toBe(25);
  });

  it("提取 '打车15.5' → 15.5", () => {
    expect(extractAmount("打车15.5")).toBe(15.5);
  });

  it("提取 '¥100买书' → 100", () => {
    expect(extractAmount("¥100买书")).toBe(100);
  });

  // 边界 case — 你来补充更多
  it("没有金额 '买了本书' → null", () => {
    expect(extractAmount("买了本书")).toBeNull();
  });

  it("多个数字取第一个合理的金额", () => {
    // TODO (human): 决定策略 — 取最大的？取第一个？
  });

  it("金额为 0 → null", () => {
    expect(extractAmount("0元")).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/mobile && npx jest __tests__/lib/rule-engine/extract-amount.test.ts
```

- [ ] **Step 3: 你来写实现**

Claude 提供的接口签名：

```typescript
// apps/mobile/lib/rule-engine/extract-amount.ts

/**
 * 从中文文本中提取金额。
 * 返回 null 表示未找到有效金额。
 */
export function extractAmount(text: string): number | null {
  // TODO (human): 实现正则提取
  // 提示: /(\d+\.?\d{0,2})\s*(元|块|¥|￥)?/
  // 注意: 金额 <= 0 应返回 null
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd apps/mobile && npx jest __tests__/lib/rule-engine/extract-amount.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/rule-engine/extract-amount.ts apps/mobile/__tests__/lib/rule-engine/extract-amount.test.ts
git commit -m "feat: add amount extraction for rule engine"
```

---

## Task 4: Rule Engine — 关键词表 + 分类匹配 (TODO human)

**Files:**
- Create: `apps/mobile/lib/rule-engine/keywords.ts` **TODO (human)**
- Create: `apps/mobile/lib/rule-engine/match-category.ts` **TODO (human)**
- Test: `apps/mobile/__tests__/lib/rule-engine/match-category.test.ts` **TODO (human)**

> **学习模式**: 关键词表是纯业务知识——你最了解中文记账场景下哪些词该归哪个分类。
>
> **设计提示**: keywords.ts 只导出一个 `Record<string, readonly string[]>` 数据结构，不含逻辑。match-category.ts 负责遍历匹配。分离数据和逻辑，未来扩展关键词只需改 keywords.ts。

- [ ] **Step 1: 创建关键词表**

```typescript
// apps/mobile/lib/rule-engine/keywords.ts

// key = 分类名（必须与 Supabase categories 表的 name 精确匹配）
// value = 触发该分类的关键词列表

export const EXPENSE_KEYWORDS: Record<string, readonly string[]> = {
  // TODO (human): 填充你的 12 个默认分类
  // 示例:
  // "餐饮": ["早餐", "午餐", "午饭", "晚餐", "晚饭", "外卖", "吃饭", "奶茶", "咖啡", "火锅", "烧烤", "饭", "餐"],
  // "交通": ["打车", "出租", "地铁", "公交", "滴滴", "高铁", "火车", "机票", "加油", "停车"],
  // ...
};

export const INCOME_KEYWORDS: readonly string[] = [
  // TODO (human): 收入关键词
  // "工资", "薪水", "收入", "红包", "转入", "报销", "奖金", "利息"
];
```

- [ ] **Step 2: 写匹配函数测试**

```typescript
// apps/mobile/__tests__/lib/rule-engine/match-category.test.ts
import { matchCategory } from "@/lib/rule-engine/match-category";

describe("matchCategory", () => {
  it("'午饭' → 餐饮", () => {
    expect(matchCategory("午饭25元")).toBe("餐饮");
  });

  it("'打车去公司' → 交通", () => {
    expect(matchCategory("打车去公司15")).toBe("交通");
  });

  it("无法匹配 → null", () => {
    expect(matchCategory("随便花了点钱")).toBeNull();
  });

  // TODO (human): 添加更多分类的测试
});
```

- [ ] **Step 3: 写匹配函数实现**

```typescript
// apps/mobile/lib/rule-engine/match-category.ts
import { EXPENSE_KEYWORDS } from "./keywords";

/**
 * 从文本中匹配消费分类名。
 * 返回 null 表示无法匹配（调用方应使用"其他"分类）。
 */
export function matchCategory(text: string): string | null {
  // TODO (human): 遍历 EXPENSE_KEYWORDS，找到第一个匹配的分类
  // 提示: 用 keyword.some(kw => text.includes(kw))
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd apps/mobile && npx jest __tests__/lib/rule-engine/match-category.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/rule-engine/keywords.ts apps/mobile/lib/rule-engine/match-category.ts apps/mobile/__tests__/lib/rule-engine/
git commit -m "feat: add category keyword matching for rule engine"
```

---

## Task 5: Rule Engine — 入口 parse()

**Files:**
- Create: `apps/mobile/lib/rule-engine/index.ts`
- Test: `apps/mobile/__tests__/lib/rule-engine/index.test.ts`

- [ ] **Step 1: 写集成测试**

```typescript
// apps/mobile/__tests__/lib/rule-engine/index.test.ts
import { parse, type ParseResult } from "@/lib/rule-engine";

describe("rule engine parse()", () => {
  it("完整匹配: '午饭25元'", () => {
    const result = parse("午饭25元");
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(25);
    expect(result!.type).toBe("expense");
    expect(result!.categoryName).toBe("餐饮");
    expect(result!.note).toBe("午饭");
  });

  it("金额匹配但分类未命中: '花了50块'", () => {
    const result = parse("花了50块");
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(50);
    expect(result!.categoryName).toBe("其他");
  });

  it("收入识别: '工资3000'", () => {
    const result = parse("工资3000");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("income");
  });

  it("无金额 → null: '买了本书'", () => {
    expect(parse("买了本书")).toBeNull();
  });

  it("空字符串 → null", () => {
    expect(parse("")).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/mobile && npx jest __tests__/lib/rule-engine/index.test.ts
```

- [ ] **Step 3: 实现 parse()**

```typescript
// apps/mobile/lib/rule-engine/index.ts
import { extractAmount } from "./extract-amount";
import { matchCategory } from "./match-category";
import { INCOME_KEYWORDS } from "./keywords";

export interface ParseResult {
  readonly amount: number;
  readonly type: "expense" | "income";
  readonly categoryName: string;
  readonly note: string;
}

export function parse(text: string): ParseResult | null {
  if (!text.trim()) return null;

  const amount = extractAmount(text);
  if (amount === null) return null;

  const isIncome = INCOME_KEYWORDS.some((kw) => text.includes(kw));
  const categoryName = matchCategory(text) ?? "其他";

  // 生成备注: 去掉金额和单位部分
  const note = text
    .replace(/[¥￥]?\d+\.?\d{0,2}\s*(元|块)?/g, "")
    .trim() || text.trim();

  return {
    amount,
    type: isIncome ? "income" : "expense",
    categoryName,
    note,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd apps/mobile && npx jest __tests__/lib/rule-engine/index.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/rule-engine/index.ts apps/mobile/__tests__/lib/rule-engine/index.test.ts
git commit -m "feat: add rule engine entry point with parse()"
```

---

## Task 6: SyncManager — 核心同步逻辑

**Files:**
- Create: `apps/mobile/lib/sync/sync-manager.ts`
- Test: `apps/mobile/__tests__/lib/sync/sync-manager.test.ts`

> **学习点**: SyncManager 是一个有状态的单例——它需要追踪"是否正在同步中"来防止并发。这和数据库连接池、线程锁是同一类问题。我们用一个简单的 boolean flag 来实现，因为 JS 是单线程的。

- [ ] **Step 1: 写测试**

```typescript
// apps/mobile/__tests__/lib/sync/sync-manager.test.ts
import * as SQLite from "expo-sqlite";
import { initQueue, enqueue, getPending, getCount } from "@/lib/queue/operation-queue";
import { createSyncManager } from "@/lib/sync/sync-manager";

let db: SQLite.SQLiteDatabase;

beforeEach(async () => {
  db = await SQLite.openDatabaseAsync(":memory:");
  await initQueue(db);
});

afterEach(async () => {
  await db.closeAsync();
});

describe("SyncManager", () => {
  it("should sync pending create operations", async () => {
    const mockApiFetch = jest.fn().mockResolvedValue({
      success: true,
      data: { id: "real_123", amount: 25 },
    });
    const mockInvalidate = jest.fn();

    const manager = createSyncManager({
      db,
      apiFetch: mockApiFetch,
      invalidateQueries: mockInvalidate,
      isOnline: () => true,
    });

    await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 25, note: "午饭", temp_id: "temp_abc" },
    });

    await manager.sync();

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(await getCount(db)).toBe(0);
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("should skip sync when offline", async () => {
    const mockApiFetch = jest.fn();
    const manager = createSyncManager({
      db,
      apiFetch: mockApiFetch,
      invalidateQueries: jest.fn(),
      isOnline: () => false,
    });

    await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 25 },
    });

    await manager.sync();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("should not run concurrent syncs", async () => {
    let resolveApi: () => void;
    const slowApi = jest.fn().mockImplementation(
      () => new Promise<{ success: boolean; data: { id: string } }>((resolve) => {
        resolveApi = () => resolve({ success: true, data: { id: "real_1" } });
      })
    );

    const manager = createSyncManager({
      db,
      apiFetch: slowApi,
      invalidateQueries: jest.fn(),
      isOnline: () => true,
    });

    await enqueue(db, { type: "create_transaction", payload: { amount: 10 } });

    const first = manager.sync();
    const second = manager.sync(); // should be no-op
    resolveApi!();
    await first;
    await second;

    expect(slowApi).toHaveBeenCalledTimes(1);
  });

  it("should skip operations with unresolved dependencies", async () => {
    const createId = await enqueue(db, {
      type: "create_transaction",
      payload: { amount: 10 },
    });
    await enqueue(db, {
      type: "delete_transaction",
      payload: { id: "temp_123" },
      dependsOn: createId,
    });

    const calls: string[] = [];
    const mockApiFetch = jest.fn().mockImplementation((path: string) => {
      calls.push(path);
      return Promise.resolve({
        success: true,
        data: { id: "real_456", amount: 10 },
      });
    });

    const manager = createSyncManager({
      db,
      apiFetch: mockApiFetch,
      invalidateQueries: jest.fn(),
      isOnline: () => true,
    });

    // First sync: processes create, skips delete (dependency exists)
    await manager.sync();
    // Second sync: dependency resolved, processes delete
    await manager.sync();

    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("/api/record/manual");
    expect(calls[1]).toContain("/api/transactions/");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/mobile && npx jest __tests__/lib/sync/sync-manager.test.ts
```

- [ ] **Step 3: 实现 SyncManager**

```typescript
// apps/mobile/lib/sync/sync-manager.ts
import type * as SQLite from "expo-sqlite";
import {
  getPending,
  markSyncing,
  markPending,
  markFailed,
  markFailedByDependency,
  remove,
  exists,
  updatePayload,
  getDependents,
  type QueueOperation,
} from "@/lib/queue/operation-queue";

interface SyncManagerConfig {
  readonly db: SQLite.SQLiteDatabase;
  readonly apiFetch: <T>(path: string, options?: RequestInit) => Promise<T>;
  readonly invalidateQueries: (keys: readonly string[]) => void;
  readonly isOnline: () => boolean;
}

interface SyncManager {
  sync(): Promise<void>;
}

const MAX_RETRIES = 3;

export function createSyncManager(config: SyncManagerConfig): SyncManager {
  const { db, apiFetch, invalidateQueries, isOnline } = config;
  let isSyncing = false;

  async function sync(): Promise<void> {
    if (isSyncing) return;
    if (!isOnline()) return;

    isSyncing = true;
    try {
      const operations = await getPending(db);

      for (const op of operations) {
        // 依赖检查
        if (op.depends_on && (await exists(db, op.depends_on))) {
          continue;
        }

        await markSyncing(db, op.id);

        try {
          await executeOperation(op);
          await remove(db, op.id);
        } catch (error) {
          const isNetworkError =
            error instanceof TypeError ||
            (error instanceof Error && error.message.includes("network"));

          if (isNetworkError) {
            await markPending(db, op.id);
            break;
          }

          const currentRetries = op.retries + 1;
          if (currentRetries >= MAX_RETRIES) {
            await markFailed(
              db,
              op.id,
              error instanceof Error ? error.message : "Unknown error"
            );
            await markFailedByDependency(db, op.id);
          } else {
            await markFailed(
              db,
              op.id,
              error instanceof Error ? error.message : "Unknown error"
            );
            await markPending(db, op.id);
          }
        }
      }

      invalidateQueries(["transactions", "chat-messages"]);
    } finally {
      isSyncing = false;
    }
  }

  async function executeOperation(op: QueueOperation): Promise<void> {
    const payload = JSON.parse(op.payload);

    if (op.type === "create_transaction") {
      const response = await apiFetch<{
        success: boolean;
        data: { id: string };
      }>("/api/record/manual", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // 更新依赖此操作的 delete 的 payload.id 为真实 ID
      const dependents = await getDependents(db, op.id);
      for (const dep of dependents) {
        const depPayload = JSON.parse(dep.payload);
        await updatePayload(db, dep.id, {
          ...depPayload,
          id: response.data.id,
        });
      }
    }

    if (op.type === "delete_transaction") {
      await apiFetch(`/api/transactions/${payload.id}`, {
        method: "DELETE",
      });
    }
  }

  return { sync };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd apps/mobile && npx jest __tests__/lib/sync/sync-manager.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/sync/ apps/mobile/__tests__/lib/sync/
git commit -m "feat: add SyncManager with dependency tracking and cascade failure"
```

---

## Task 7: useSync Hook — 网络/AppState 监听

**Files:**
- Create: `apps/mobile/hooks/useSync.ts`

- [ ] **Step 1: 实现 useSync**

```typescript
// apps/mobile/hooks/useSync.ts
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import type { createSyncManager } from "@/lib/sync/sync-manager";

type SyncManager = ReturnType<typeof createSyncManager>;

/**
 * 监听网络状态和 AppState 变化，自动触发同步。
 * 触发时机:
 *   1. 网络恢复 (offline → online)
 *   2. App 回到前台 (background → active)
 *   3. App 启动时
 */
export function useSync(manager: SyncManager | null): void {
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!manager) return;

    // App 启动时立刻尝试同步
    manager.sync();

    // 监听网络状态
    const unsubNet = NetInfo.addEventListener((state) => {
      if (state.isConnected && wasOffline.current) {
        manager.sync();
      }
      wasOffline.current = !state.isConnected;
    });

    // 监听 AppState
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        manager.sync();
      }
    };
    const subAppState = AppState.addEventListener("change", handleAppState);

    return () => {
      unsubNet();
      subAppState.remove();
    };
  }, [manager]);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/hooks/useSync.ts
git commit -m "feat: add useSync hook for network/AppState sync triggers"
```

---

## Task 8: useOfflineQueue Hook (TODO human)

**Files:**
- Create: `apps/mobile/hooks/useOfflineQueue.ts` **TODO (human)**

> **学习模式**: 这个 Hook 是连接底层队列和上层 UI 的桥梁。它需要：
> 1. 调用 `enqueue()` 写入队列
> 2. 用 React Query 的 `setQueryData` 做乐观更新
> 3. 处理删除的三种状态（pending/syncing/已同步）
>
> **TDD 提示**: Hook 测试比纯函数复杂，需要 mock React Query 的 queryClient。先实现 `enqueueCreate`，确保能跑通，再加 `enqueueDelete`。

- [ ] **Step 1: 你来写 useOfflineQueue**

Claude 提供的接口和骨架：

```typescript
// apps/mobile/hooks/useOfflineQueue.ts
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { v4 as uuid } from "uuid";
import type * as SQLite from "expo-sqlite";
import {
  enqueue,
  getPending,
  remove,
  findByTempId,
  type QueueOperation,
} from "@/lib/queue/operation-queue";
import type { Transaction } from "@coco/shared";
import type { createSyncManager } from "@/lib/sync/sync-manager";

type SyncManager = ReturnType<typeof createSyncManager>;

interface UseOfflineQueueParams {
  readonly db: SQLite.SQLiteDatabase | null;
  readonly syncManager: SyncManager | null;
}

interface UseOfflineQueueReturn {
  /**
   * 创建交易: 写入队列 + 乐观更新 React Query 缓存
   * 返回临时 ID
   */
  readonly enqueueCreate: (params: {
    amount: number;
    categoryId: string;
    categoryName: string;
    note: string;
    type: "expense" | "income";
    occurredAt: string;
  }) => Promise<string>;

  /**
   * 删除交易: 根据队列状态决定策略 + 乐观移除
   */
  readonly enqueueDelete: (transactionId: string) => Promise<void>;
}

export function useOfflineQueue({
  db,
  syncManager,
}: UseOfflineQueueParams): UseOfflineQueueReturn {
  const queryClient = useQueryClient();

  const enqueueCreate = useCallback(
    async (params: {
      amount: number;
      categoryId: string;
      categoryName: string;
      note: string;
      type: "expense" | "income";
      occurredAt: string;
    }): Promise<string> => {
      if (!db) throw new Error("Database not initialized");

      const tempId = `temp_${uuid()}`;

      // TODO (human): 实现以下逻辑
      // 1. 调用 enqueue() 写入 SQLite 队列
      // 2. 构造一个临时 Transaction 对象
      // 3. 用 queryClient.setQueryData 乐观更新 ["transactions", 1] 缓存
      //    提示: 将新 transaction 插入到 data.data 数组的开头
      // 4. 如果有网，触发 syncManager.sync()
      // 5. 返回 tempId

      return tempId;
    },
    [db, queryClient, syncManager]
  );

  const enqueueDelete = useCallback(
    async (transactionId: string): Promise<void> => {
      if (!db) throw new Error("Database not initialized");

      // TODO (human): 实现以下逻辑
      // 1. 检查队列中是否有该 transactionId 的 create 操作
      //    - 如果 status='pending' → remove() 直接移除
      //    - 如果 status='syncing' → enqueue delete with depends_on
      //    - 不存在 → enqueue delete 操作
      // 2. queryClient.setQueryData 乐观移除该交易
      // 3. 如果有网，触发 syncManager.sync()
    },
    [db, queryClient, syncManager]
  );

  return { enqueueCreate, enqueueDelete };
}
```

- [ ] **Step 2: 你来写测试**

- [ ] **Step 3: 运行测试确认通过**

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/hooks/useOfflineQueue.ts
git commit -m "feat: add useOfflineQueue hook for optimistic create/delete"
```

---

## Task 9: App 初始化 — SQLite + SyncManager

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: 读取当前 _layout.tsx**

确认当前结构后再修改。

- [ ] **Step 2: 添加 SQLite 初始化和 SyncManager**

在 `_layout.tsx` 中添加：

```typescript
// 在现有 imports 后添加:
import { useMemo, useEffect, useState } from "react";
import * as SQLite from "expo-sqlite";
import { initQueue, resetSyncingToPending } from "@/lib/queue/operation-queue";
import { createSyncManager } from "@/lib/sync/sync-manager";
import { useSync } from "@/hooks/useSync";
import { apiFetch } from "@/lib/api";
import NetInfo from "@react-native-community/netinfo";

// 在 RootLayout 组件内添加:
const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
const [syncManager, setSyncManager] = useState<ReturnType<typeof createSyncManager> | null>(null);

useEffect(() => {
  async function initDatabase() {
    const database = await SQLite.openDatabaseAsync("coco-queue");
    await initQueue(database);
    await resetSyncingToPending(database);
    setDb(database);

    const manager = createSyncManager({
      db: database,
      apiFetch,
      invalidateQueries: (keys) => {
        for (const key of keys) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      },
      isOnline: () => {
        // NetInfo 的同步检查需要缓存上一次状态
        // 简化: 默认在线，sync 内部会 catch 网络错误
        return true;
      },
    });
    setSyncManager(manager);
  }

  initDatabase();
}, []);

useSync(syncManager);
```

需要通过 React Context 将 `db` 和 `syncManager` 传递给子组件。创建 Context：

```typescript
// 在 _layout.tsx 中或单独文件
import { createContext, useContext } from "react";

interface OfflineContextValue {
  readonly db: SQLite.SQLiteDatabase | null;
  readonly syncManager: ReturnType<typeof createSyncManager> | null;
}

export const OfflineContext = createContext<OfflineContextValue>({
  db: null,
  syncManager: null,
});

export function useOfflineContext() {
  return useContext(OfflineContext);
}
```

在 JSX 中包裹：

```tsx
<QueryClientProvider client={queryClient}>
  <OfflineContext.Provider value={{ db, syncManager }}>
    <Slot />
  </OfflineContext.Provider>
</QueryClientProvider>
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "feat: initialize SQLite queue and SyncManager on app startup"
```

---

## Task 10: 集成 — ManualEntryForm 改用队列

**Files:**
- Modify: `apps/mobile/components/ManualEntryForm.tsx`

- [ ] **Step 1: 读取当前 ManualEntryForm**

- [ ] **Step 2: 替换 handleSubmit 的 API 调用为队列写入**

核心改动 — 将：
```typescript
// 旧: 直接调 API，等 1s
const resp = await apiFetch("/api/record/manual", { ... });
```
替换为：
```typescript
// 新: 写入本地队列，~5ms
const { enqueueCreate } = useOfflineQueue({
  db: offlineContext.db,
  syncManager: offlineContext.syncManager,
});

const tempId = await enqueueCreate({
  amount: parsedAmount,
  categoryId: selectedCategory,
  categoryName: categoryName,
  note,
  type: transactionType,
  occurredAt: date.toISOString(),
});
```

- 移除 `submitting` 状态的等待（本地写入几乎是同步的）
- 移除 `invalidateQueries` 调用（乐观更新已在 hook 中完成）
- 保留表单验证逻辑不变
- `onSuccess` 回调传入临时 transaction 对象

- [ ] **Step 3: 手动测试**

1. 打开 app，进入手动记账
2. 填写金额和分类，点保存
3. 验证: UI 立刻响应（<50ms），交易列表立刻出现新记录
4. 检查 BFF 日志: 后台同步请求应在数秒内到达

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/ManualEntryForm.tsx
git commit -m "feat: ManualEntryForm uses offline queue for instant save"
```

---

## Task 11: 集成 — useChat 加入规则引擎

**Files:**
- Modify: `apps/mobile/hooks/useChat.ts`

- [ ] **Step 1: 读取当前 useChat.ts**

- [ ] **Step 2: 在 sendText 中加入规则引擎前置拦截**

```typescript
import { parse } from "@/lib/rule-engine";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useOfflineContext } from "@/app/_layout";

// 在 sendText 方法开头:
const sendText = useCallback(async (text: string) => {
  // 1. 先尝试规则引擎
  const ruleResult = parse(text);

  if (ruleResult) {
    // 规则命中 → 本地入队，不走 BFF
    const categories = queryClient.getQueryData<{ data: Category[] }>(["categories"]);
    const category = categories?.data?.find(
      (c) => c.name === ruleResult.categoryName && c.type === ruleResult.type
    ) ?? categories?.data?.find((c) => c.name === "其他");

    if (category) {
      await enqueueCreate({
        amount: ruleResult.amount,
        categoryId: category.id,
        categoryName: category.name,
        note: ruleResult.note,
        type: ruleResult.type,
        occurredAt: new Date().toISOString(),
      });
      // 不插入聊天消息（等 BFF 同步后自然产生）
      return;
    }
  }

  // 2. 规则未命中 → 检查网络
  //    - 在线 → 走原有 BFF/GLM 流程（代码不变）
  //    - 离线 → 引导手动填写
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    addMessage({
      role: "assistant",
      content_type: "text",
      content: "当前离线，无法识别这条记录。请使用手动记账填写金额和分类。",
    });
    return;
  }

  // 原有 BFF 调用逻辑不变...
}, [/* deps */]);
```

- [ ] **Step 3: 手动测试**

1. 输入 "午饭25元" → 应立刻记账成功（规则命中，不走网络）
2. 输入 "帮我查上个月花了多少" → 应走 BFF GLM（规则未命中）
3. 断网后输入 "随便花了点" → 应提示手动填写

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/hooks/useChat.ts
git commit -m "feat: integrate rule engine into text recording flow"
```

---

## Task 12: 集成 — 删除交易改用队列

**Files:**
- Modify: `apps/mobile/hooks/useTransactions.ts`

- [ ] **Step 1: 读取当前 useDeleteTransaction**

- [ ] **Step 2: 替换为 useOfflineQueue.enqueueDelete**

将现有的直接 API 调用替换为 `enqueueDelete`，实现乐观删除。

```typescript
export function useDeleteTransaction() {
  const { db, syncManager } = useOfflineContext();
  const { enqueueDelete } = useOfflineQueue({ db, syncManager });

  return useMutation({
    mutationFn: async (id: string) => {
      await enqueueDelete(id);
    },
    // 不需要 onSuccess invalidate — enqueueDelete 已乐观更新
  });
}
```

- [ ] **Step 3: 手动测试**

1. 删除一笔已同步的交易 → UI 立刻消失
2. 离线创建一笔 → 再删除 → create 应从队列中移除（不需要同步 delete）

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/hooks/useTransactions.ts
git commit -m "feat: delete transactions via offline queue with optimistic removal"
```

---

## Task 13: 同步状态 UI 指示器

**Files:**
- Create: `apps/mobile/components/shared/SyncIndicator.tsx`

- [ ] **Step 1: 实现 SyncIndicator 组件**

```typescript
// apps/mobile/components/shared/SyncIndicator.tsx
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useOfflineContext } from "@/app/_layout";
import { getCount } from "@/lib/queue/operation-queue";

export function SyncIndicator() {
  const { db } = useOfflineContext();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!db) return;

    const interval = setInterval(async () => {
      const count = await getCount(db);
      setPendingCount(count);
    }, 2000);

    return () => clearInterval(interval);
  }, [db]);

  if (pendingCount === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {pendingCount} 条待同步
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    color: "#fff",
    fontSize: 12,
  },
});
```

- [ ] **Step 2: 在 tabs layout 中添加**

```typescript
// apps/mobile/app/(tabs)/_layout.tsx
import { SyncIndicator } from "@/components/shared/SyncIndicator";
// 在 JSX 中合适位置添加 <SyncIndicator />
```

- [ ] **Step 3: 手动测试**

1. 断网 → 记一笔账 → 应显示 "1 条待同步"
2. 恢复网络 → 同步完成后 → 指示器消失

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/shared/SyncIndicator.tsx apps/mobile/app/\(tabs\)/_layout.tsx
git commit -m "feat: add sync status indicator in tab bar"
```

---

## Task 14: 端到端验证

- [ ] **Step 1: 在线记账流程**

1. 手动记账 → 保存 → UI 立刻响应 ✅
2. 文字 "午饭25元" → 规则命中 → 立刻记账 ✅
3. 文字 "帮我查上月消费" → GLM 处理 → 返回结果 ✅
4. 删除一笔账 → 立刻消失 ✅

- [ ] **Step 2: 离线记账流程**

1. 开启飞行模式
2. 手动记账 → 保存 → UI 立刻响应 ✅
3. 文字 "打车15" → 规则命中 → 立刻记账 ✅
4. 文字 "报销差旅费" → 规则未命中 → 提示手动填写 ✅
5. 同步指示器显示 "2 条待同步" ✅

- [ ] **Step 3: 恢复网络同步**

1. 关闭飞行模式
2. 等待数秒 → 同步指示器消失 ✅
3. 刷新交易列表 → 离线创建的记录仍在，ID 已替换为真实 ID ✅
4. 检查 Supabase → 数据已持久化 ✅

- [ ] **Step 4: Final commit**

```bash
git commit -m "test: verify offline-first end-to-end flows"
```

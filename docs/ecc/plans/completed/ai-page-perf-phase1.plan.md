# Plan: AI 聊天页性能优化 — Phase 1 索引优化

## Summary

在 `schema.ts` 的 `runMigrations()` 中添加一条复合部分索引，使
`chat_messages` 的高频查询（`WHERE user_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 30`）
完整走索引覆盖扫描，消除当前双单列索引的全表过滤问题。同时补充对应的迁移测试。

## User Story

作为 CoCo App 用户，我想要点击 AI 按钮后快速看到聊天界面，这样我不会因为等待而分心放弃记账。

## Problem → Solution

**当前**: `WHERE user_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 30`
查询时，SQLite 只能使用 `idx_chat_messages_user_id(user_id)` 或 `idx_chat_messages_created_at(created_at DESC)` 之一，
另一个条件需要额外过滤，消息量大时有全表扫描风险。

**目标**: 新增复合部分索引 `(user_id, created_at DESC) WHERE deleted_at IS NULL`，
让 SQLite 通过单次 range scan 直接返回目标数据，无需额外过滤或排序。

## Metadata

- **Complexity**: Small
- **Source PRD**: `docs/ecc/prds/ai-page-perf.prd.md`
- **PRD Phase**: Phase 1 — 索引优化
- **Estimated Files**: 2 个（schema.ts + schema-migration.test.ts）

---

## UX Design

**N/A — 纯数据库层变更，无用户可见界面改动。**
效果通过 Dev 模式页面标题的 `loadMs` 指标验证。

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 (critical) | `apps/mobile/lib/db/schema.ts` | 115-168 | 现有迁移写法，新索引插入位置 |
| P0 (critical) | `apps/mobile/hooks/useLocalChatMessages.ts` | 23-39 | 被优化的 SQL 查询原文 |
| P1 (important) | `apps/mobile/lib/db/__tests__/schema-migration.test.ts` | 1-58 | 测试模式：in-memory DB + PRAGMA |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| SQLite 部分索引 | SQLite 官方文档 | 查询的 WHERE 子句必须是索引 WHERE 子句的**超集**，部分索引才会被选用 |
| SQLite EXPLAIN QUERY PLAN | SQLite 官方文档 | 用 `EXPLAIN QUERY PLAN <sql>` 验证索引是否被使用 |

---

## Patterns to Mirror

### CREATE_INDEX_PATTERN
```typescript
// SOURCE: apps/mobile/lib/db/schema.ts:149-154
await db.execAsync(
  "CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)",
);
await db.execAsync(
  "CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id)",
);
// 带排序方向的单列索引示例：
await db.execAsync(
  "CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC)",
);
```

### MIGRATION_TEST_PATTERN
```typescript
// SOURCE: apps/mobile/lib/db/__tests__/schema-migration.test.ts:1-58
import { openDatabaseAsync } from "expo-sqlite";
import { createTables } from "../schema";

describe("schema migration: <feature>", () => {
  it("<具体验证内容>", async () => {
    const db = await openDatabaseAsync(":memory:");
    await createTables(db);
    // 用 PRAGMA / 查询验证结果
  });
});
```

### INDEX_EXISTENCE_CHECK_PATTERN
```typescript
// SQLite 查索引列表的标准做法（参考 schema.ts:236-244 的 PRAGMA table_info 模式）
const indexes = await db.getAllAsync<{ name: string; sql: string }>(
  "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='chat_messages'",
);
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/mobile/lib/db/schema.ts` | UPDATE | 在 `runMigrations()` 末尾添加复合部分索引 |
| `apps/mobile/lib/db/__tests__/schema-migration.test.ts` | UPDATE | 添加测试验证新索引存在且 SQL 包含 WHERE 子句 |

## NOT Building

- 删除旧索引 `idx_chat_messages_created_at`（保留，不造成破坏性变更）
- 对 categories 表做类似优化（categories 数据量小，当前查询已足够快）
- 修改查询 SQL 本身（Phase 3 会处理双重 reverse，但查询 SQL 不变）

---

## Step-by-Step Tasks

### Task 1: 在 runMigrations() 中添加复合部分索引

- **ACTION**: 在 `schema.ts` 的 `runMigrations()` 函数末尾，现有 `idx_chat_messages_created_at` 索引之后，添加新的复合部分索引
- **IMPLEMENT**:
  ```typescript
  // 复合部分索引：覆盖 WHERE user_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 30
  // 仅对未删除行建索引，体积更小、扫描更快
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_user_active ON chat_messages(user_id, created_at DESC) WHERE deleted_at IS NULL",
  );
  ```
- **MIRROR**: `CREATE_INDEX_PATTERN` — 使用 `CREATE INDEX IF NOT EXISTS` + 全小写索引名
- **IMPORTS**: 无新增 import（`db` 已是函数参数）
- **GOTCHA**: 
  - 部分索引语法：`CREATE INDEX ... ON table(cols) WHERE condition`，`WHERE` 子句中的列不必在索引列中
  - `deleted_at` 列是在本次 `runMigrations()` 的前面通过 `addColumnIfNotExists` 添加的，所以在添加索引之前列一定存在
  - 在内存数据库中测试时，`createTables` 会从头建表，`deleted_at` 列在 `CREATE_CHAT_MESSAGES` 语句中**没有**（只通过迁移加入），但 `addColumnIfNotExists` 在同一次 `runMigrations()` 调用中会先加列，再建索引，顺序是对的
- **VALIDATE**: 
  ```sql
  -- 在 SQLite shell 或测试中运行：
  EXPLAIN QUERY PLAN
  SELECT * FROM chat_messages
  WHERE user_id = 'test' AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 30;
  -- 期望输出包含：USING INDEX idx_chat_messages_user_active
  ```

### Task 2: 补充迁移测试

- **ACTION**: 在 `schema-migration.test.ts` 中添加新的 `describe` 块，验证 `idx_chat_messages_user_active` 索引存在且 SQL 包含 partial 子句
- **IMPLEMENT**:
  ```typescript
  describe("schema migration: chat_messages 复合部分索引", () => {
    it("创建 idx_chat_messages_user_active 部分索引", async () => {
      const db = await openDatabaseAsync(":memory:");
      await createTables(db);

      const indexes = await db.getAllAsync<{ name: string; sql: string | null }>(
        "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='chat_messages'",
      );
      const target = indexes.find(
        (i) => i.name === "idx_chat_messages_user_active",
      );

      expect(target).toBeDefined();
      // 验证 partial index 语法：WHERE deleted_at IS NULL
      expect(target?.sql?.toLowerCase()).toContain("where deleted_at is null");
    });

    it("idx_chat_messages_user_active 包含 user_id 和 created_at 列", async () => {
      const db = await openDatabaseAsync(":memory:");
      await createTables(db);

      const indexes = await db.getAllAsync<{ name: string; sql: string | null }>(
        "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='chat_messages'",
      );
      const target = indexes.find(
        (i) => i.name === "idx_chat_messages_user_active",
      );

      expect(target?.sql?.toLowerCase()).toContain("user_id");
      expect(target?.sql?.toLowerCase()).toContain("created_at");
    });
  });
  ```
- **MIRROR**: `MIGRATION_TEST_PATTERN` — `openDatabaseAsync(":memory:")` + `createTables(db)` + 验证
- **IMPORTS**: 已有 `import { openDatabaseAsync } from "expo-sqlite"` 和 `import { createTables } from "../schema"` — 无需新增
- **GOTCHA**: `sqlite_master` 中内置索引（如主键）的 `sql` 字段为 `null`，需要用 `?.` 安全访问；用户创建的索引 `sql` 字段包含完整 DDL
- **VALIDATE**: 运行 `pnpm --filter mobile test lib/db/__tests__/schema-migration` 全部测试通过

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| 索引是否创建 | `:memory:` DB + `createTables()` | `idx_chat_messages_user_active` 存在于 `sqlite_master` | 否 |
| 索引 SQL 包含 WHERE 子句 | 同上 | `sql` 字段包含 `where deleted_at is null` | 否 |
| 索引 SQL 包含目标列 | 同上 | `sql` 字段包含 `user_id` 和 `created_at` | 否 |
| 幂等性：重复调用 createTables | 调用 `createTables` 两次 | 不报错，索引仍存在 | 是（`IF NOT EXISTS` 保证） |

### Edge Cases Checklist
- [x] `IF NOT EXISTS` 保证幂等，重复迁移不报错
- [x] `deleted_at` 列在 `addColumnIfNotExists` 中先于索引创建（顺序正确）
- [x] 内存数据库测试中 `deleted_at` 列不在初始 DDL 中，但迁移步骤会加入

---

## Validation Commands

### Unit Tests
```bash
# 只跑 schema 迁移测试
pnpm --filter mobile test lib/db/__tests__/schema-migration
```
EXPECT: 所有测试通过，包含新增的 2 个 case

### Full Test Suite
```bash
pnpm --filter mobile test
```
EXPECT: 无回归

### 静态分析
```bash
pnpm --filter mobile lint
```
EXPECT: 零 lint 报错（本次改动只加字符串，基本不会有类型问题）

### 手动验证（Dev 模式）
```bash
pnpm --filter mobile dev
```
进入 AI 页，观察标题中 `loadMs` 数值是否明显下降（对比 Phase 2 完成后效果更明显）

---

## Acceptance Criteria
- [x] `idx_chat_messages_user_active` 在 `runMigrations()` 中创建
- [x] 索引为 Partial Index，包含 `WHERE deleted_at IS NULL`
- [x] 现有 `idx_chat_messages_created_at` 保持不变（无破坏性）
- [x] 迁移测试全部通过
- [x] 全套测试无回归

## Completion Checklist
- [ ] `schema.ts` 新增索引代码
- [ ] `schema-migration.test.ts` 新增 2 个测试 case
- [ ] `pnpm --filter mobile test` 全部通过
- [ ] `pnpm --filter mobile lint` 无报错
- [ ] PRD Phase 1 状态更新为 `in-progress` → `complete`

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 老设备 SQLite < 3.8（不支持部分索引） | 极低 | HIGH | expo-sqlite 底层 SQLite ≥ 3.39，React Native 最低 Android 5.0 已是 3.7+，iOS 也已远超 3.8 |
| `deleted_at` 列在索引创建时不存在 | 低 | MEDIUM | 检查 `runMigrations()` 中 `addColumnIfNotExists(db, "chat_messages", "deleted_at", "TEXT")` 在新索引之前执行（第 192 行，新索引追加在末尾） |
| 测试中 `sqlite_master.sql` 为 null | 低 | LOW | 使用 `?.toLowerCase()` 安全访问，已在测试代码中处理 |

## Notes

- Phase 1 是后续所有优化的地基，完成后立即进入 Phase 2（预取）和 Phase 3（双重 reverse 消除），两者可并行
- 新索引命名规范：`idx_{表名}_{语义}` — `idx_chat_messages_user_active` 中 `user_active` 表示"按用户过滤活跃（未删除）消息"
- 不删除旧索引 `idx_chat_messages_created_at`：它可能被其他查询使用（如全局时间线），且 `IF NOT EXISTS` 已保证幂等

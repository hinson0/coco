# 多设备同步设计文档

**日期**：2026-04-09
**功能**：SQLite → PostgreSQL 后台同步 + 手动多设备数据还原

---

## 背景

CoCo 当前以本地 SQLite 为唯一数据源（纯离线架构）。本方案在不影响 UI 流畅度的前提下，将本地数据持续备份到 PostgreSQL，并在用户换机时支持一键还原。

---

## 需求摘要

| 维度 | 决策 |
|------|------|
| 同步表 | 全部 6 张：transactions、categories、budgets、chat_messages、accounts、user_profiles |
| Push 方向 | 本地 → PostgreSQL（自动，每 30 秒，静默后台） |
| Pull 方向 | PostgreSQL → 本地（手动，「多设备同步」页面触发） |
| 冲突策略 | Last-write-wins：`updated_at` 更新的一方胜 |
| UI | Push 完全静默无感；Pull 有独立帮助页面 + 「立即同步」按钮 |

---

## 架构

```
手机 SQLite ──push──→ PostgreSQL   （每 30s 自动，静默）
手机 SQLite ←─pull── PostgreSQL   （手动触发，换机场景）

触发路径（Pull）：
  我的 → 工具 → 多设备同步 → sync-help.tsx → 「立即同步」按钮
```

### SyncService（前端）

新建 `apps/mobile/lib/sync/sync-service.ts`：

- `push(db, userId)`
  1. 查询本地所有表中 `updated_at > last_push_at` 的记录
  2. 通过现有 `apiFetch` 批量 POST 到 `/sync/push`（token 由 apiFetch 内部管理）
  3. 成功后将 `last_push_at` 更新为本次同步时间

- `pull(db, userId)`
  1. 通过 `apiFetch` GET `/sync/pull` 拉取该用户在 PostgreSQL 的全量数据
  2. 对每条记录与本地做 LWW 合并（`updated_at` 更新者写入）
  3. 成功后将 `last_pull_at` 更新为本次同步时间

两个方法均为 async，调用方不 await（fire-and-forget），不阻塞 UI。

### 定时 Push（前端）

在根 `_layout.tsx` 的 `useEffect` 中：

```ts
const interval = setInterval(() => {
  if (db && userId) push(db, userId).catch(() => {});
}, 30_000);
return () => clearInterval(interval);
```

---

## 数据模型变更

### SQLite（前端写）

1. **给 5 张表加 `updated_at TEXT`**（`user_profiles` 已有）
   - 通过现有 `addColumnIfNotExists` 迁移机制
   - 存量数据默认值：有 `created_at` 的表填 `created_at`，`budgets` 表无 `created_at` 则填 `datetime('now')`

2. **新增 `sync_watermarks` 表**

```sql
CREATE TABLE IF NOT EXISTS sync_watermarks (
  table_name   TEXT PRIMARY KEY,
  last_push_at TEXT,
  last_pull_at TEXT
);
```

3. **写操作时维护 `updated_at`**
   - 所有 `INSERT` / `UPDATE` 语句加上 `updated_at = datetime('now')`

### PostgreSQL（后端，用户手写）

需要两个 Alembic migration（可合并为一个）：

**步骤一：补建 SQLite 有但 PG 没有的两张表**

当前 PG schema 缺少 `accounts` 和 `user_profiles`，需先建表：

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id          uuid PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  icon        text NOT NULL,
  type        text NOT NULL,
  initial_balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id           uuid PRIMARY KEY,
  nickname     text,
  avatar_type  text NOT NULL DEFAULT 'emoji',
  avatar_value text NOT NULL DEFAULT '🌿',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
```

**步骤二：给其余 4 张已有表加 `updated_at`**

```sql
ALTER TABLE categories   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE budgets      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
```

**步骤三：加触发器（每张表），`ON UPDATE` 时自动刷新 `updated_at`**

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- 对每张表执行：
CREATE TRIGGER trg_<table>_updated_at
BEFORE UPDATE ON <table>
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## 后端 API（用户手写）

新建 `apps/backend/routers/sync.py`，注册到 `routers/__init__.py`。

### `POST /sync/push`

**请求体**：

```json
{
  "transactions": [...],
  "categories": [...],
  "budgets": [...],
  "chat_messages": [...],
  "accounts": [...],
  "user_profiles": [...]
}
```

**逻辑**：对每条记录执行 upsert，LWW 在数据库层实现。以 transactions 为例：

```sql
INSERT INTO transactions (id, user_id, category_id, amount, type, note,
  occurred_at, source, raw_input, receipt_url, ai_confidence,
  created_at, updated_at, deleted_at, account_id)
VALUES (...)
ON CONFLICT (id) DO UPDATE SET
  category_id   = excluded.category_id,
  amount        = excluded.amount,
  type          = excluded.type,
  note          = excluded.note,
  occurred_at   = excluded.occurred_at,
  source        = excluded.source,
  raw_input     = excluded.raw_input,
  receipt_url   = excluded.receipt_url,
  ai_confidence = excluded.ai_confidence,
  updated_at    = excluded.updated_at,
  deleted_at    = excluded.deleted_at,
  account_id    = excluded.account_id
WHERE excluded.updated_at > transactions.updated_at;
-- 其余 5 张表逻辑相同：更新除 id 以外的所有字段，条件为 excluded.updated_at 更新
```

**响应**：`{ "ok": true }`

### `GET /sync/pull`

**逻辑**：返回当前认证用户的全量数据（含软删除记录，客户端做 LWW 合并）。

**响应**：同 push 请求体结构。

---

## 前端文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `lib/db/schema.ts` | 修改 | 加 `updated_at` 字段迁移 + `sync_watermarks` 表 |
| `lib/sync/sync-service.ts` | 新建 | push / pull 核心逻辑 |
| `lib/sync/watermarks.ts` | 新建 | 读写 `sync_watermarks` 水位线 |
| `app/_layout.tsx` | 修改 | 加 30s 定时 push |
| `app/(tabs)/profile.tsx` | 修改 | 工具 Section 加「多设备同步」MenuItem |
| `app/sync-help.tsx` | 新建 | 帮助说明页 + 「立即同步」按钮 |

---

## 前端实现顺序

1. Schema 迁移（`updated_at` + `sync_watermarks`）
2. `watermarks.ts`（水位线读写）
3. `sync-service.ts`（push / pull）
4. `_layout.tsx` 定时 push
5. `sync-help.tsx` 帮助页
6. `profile.tsx` 加入口 MenuItem

---

## 错误处理

- Push 失败：静默吞掉（`catch(() => {})`），下次 30s 重试
- Pull 失败：在 `sync-help.tsx` 的「立即同步」按钮附近显示简短错误文本（如"同步失败，请检查网络"），不用 Toast

---

## 不在本期范围内

- 细粒度增量 pull（本期全量拉取，数据量小可接受）
- 同步进度条 / 详细状态 UI
- 后台网络恢复自动 pull
- `chat_messages` 中音频文件（`audio_uri`）的同步

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

- `push(db, userId, token)`
  1. 查询本地所有表中 `updated_at > last_push_at` 的记录
  2. 批量 POST 到 `/sync/push`
  3. 成功后将 `last_push_at` 更新为本次同步时间

- `pull(db, userId, token)`
  1. GET `/sync/pull` 拉取该用户在 PostgreSQL 的全量数据
  2. 对每条记录与本地做 LWW 合并（`updated_at` 更新者写入）
  3. 成功后将 `last_pull_at` 更新为本次同步时间

两个方法均为 async，调用方不 await（fire-and-forget），不阻塞 UI。

### 定时 Push（前端）

在根 `_layout.tsx` 的 `useEffect` 中：

```ts
const interval = setInterval(() => {
  if (db && userId && token) push(db, userId, token).catch(() => {});
}, 30_000);
return () => clearInterval(interval);
```

---

## 数据模型变更

### SQLite（前端写）

1. **给 5 张表加 `updated_at TEXT`**（`user_profiles` 已有）
   - 通过现有 `addColumnIfNotExists` 迁移机制
   - 存量数据默认填 `created_at` 的值

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

新建 Alembic migration：

1. 给 6 张表加 `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
2. 加触发器（每张表）：`ON UPDATE` 时自动将 `updated_at` 设为 `now()`

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

**逻辑**：对每条记录执行 upsert，LWW 在数据库层实现：

```sql
INSERT INTO transactions (...) VALUES (...)
ON CONFLICT (id) DO UPDATE SET ...
WHERE excluded.updated_at > transactions.updated_at;
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

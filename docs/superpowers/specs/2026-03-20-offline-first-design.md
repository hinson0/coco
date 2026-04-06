# Offline-First 离线优先架构设计

> 日期: 2026-03-20
> 状态: Draft

## 1. 背景与动机

当前 CoCo AI 记账应用所有写操作（创建/删除交易）均需通过 `移动端 → Next.js BFF → Supabase` 完成。即使网络正常，用户也需等待约 1s 的 API 往返。

**核心目标**: 让写操作（手动记账、文字记账、删除）即时响应，用户无需感知网络延迟。

## 2. 设计决策记录

| 决策点 | 结论 | 备选项 |
|--------|------|--------|
| 核心痛点 | 操作即时响应，不等 API 往返 | — |
| 离线写入范围 | 创建 + 编辑 + 删除交易 | 仅创建+删除 / 全部 CRUD |
| 冲突策略 | Last Write Wins（客户端赢） | 服务端赢 / 用户选择 |
| 同步链路 | 保持现有 BFF，客户端加操作队列 | 绕过 BFF 直连 Supabase |
| 本地存储 | expo-sqlite | AsyncStorage / MMKV |
| GLM 场景 | BFF 原样处理（解析+写库一步完成） | 拆分为解析和写库两步 |
| 离线+规则失败 | 引导手动填写 | 存入待处理队列联网后走 GLM |
| 规则管理 | 内置固定规则 | 用户自定义 / 服务端下发 |
| source 字段 | 规则引擎使用 `rule`，手动使用 `manual` | 统一 manual |
| 聊天消息 | 客户端乐观插入 + BFF skip_chat | 延迟到同步后 |
| BFF 改动 | 两处小改动（source 透传 + skip_chat） | 零改动 |

## 3. 整体架构

```
┌─────────────────────── 移动端 ───────────────────────┐
│                                                       │
│   UI Layer (React Native)                             │
│       ↕ (读)                                          │
│   React Query Cache (+ AsyncStorage 持久化)           │
│       ↕ (乐观更新)                                    │
│  ┌────────────────────────────────────────────┐       │
│  │ Rule Engine (纯本地文本解析)                 │       │
│  │  - 正则匹配金额、分类关键词、日期            │       │
│  │  - 匹配成功 → 构造 transaction 对象          │       │
│  │  - 匹配失败 → 在线走 GLM / 离线引导手动填写  │       │
│  └────────────────────────────────────────────┘       │
│       ↓ (写入)                                        │
│  ┌────────────────────────────────────────────┐       │
│  │ Operation Queue (expo-sqlite)               │       │
│  │  - 存储待同步操作 (create/update/delete)     │       │
│  │  - app 启动时检查 & 恢复                     │       │
│  │  - 联网时自动重放到 BFF API                  │       │
│  └────────────────────────────────────────────┘       │
│       ↓ (联网时)                                      │
│   apiFetch (现有)                                     │
│       ↓                                               │
└───────┼───────────────────────────────────────────────┘
        ↓
   Next.js BFF (不改动) → Supabase
```

**关键原则**:
- React Query 仍然是 UI 的数据源，不改变现有读取逻辑
- Operation Queue 是写入的中间层，所有本地写操作先进队列
- Rule Engine 是 BFF 的前置拦截器，能本地解决的不走网络
- BFF 两处小改动: source 透传 + skip_chat 参数

## 4. 写入路径分类

| 场景 | 路径 | 写库方 |
|------|------|--------|
| 手动记账 | 本地 → 队列 → 后台同步 | 客户端队列 |
| 文字记账（规则命中） | 本地 → 队列 → 后台同步 | 客户端队列 |
| 文字记账（规则未命中） | BFF (GLM 解析 + 写库) | BFF 原样 |
| ASR（云端转文字 → 规则命中） | 本地 → 队列 → 后台同步 | 客户端队列 |
| ASR（云端转文字 → 规则未命中） | BFF (GLM + 写库) | BFF 原样 |
| OCR（云端识别 → 规则命中） | 本地 → 队列 → 后台同步 | 客户端队列 |
| OCR（云端识别 → 规则未命中） | BFF (GLM + 写库) | BFF 原样 |
| 编辑交易 | 本地 → 队列 → 后台同步 | 客户端队列 |
| 删除交易 | 本地 → 队列 → 后台同步 | 客户端队列 |

## 5. 前置依赖

新增以下依赖到 `apps/mobile/package.json`:

```
expo-sqlite          -- 本地 SQLite 数据库（Expo SDK 55 内置，无需 native rebuild）
@react-native-community/netinfo  -- 网络状态监听
```

## 6. Operation Queue（操作队列）

### 6.1 SQLite 表结构

```sql
CREATE TABLE IF NOT EXISTS operation_queue (
  id          TEXT PRIMARY KEY,        -- UUID
  type        TEXT NOT NULL,           -- 'create_transaction' | 'update_transaction' | 'delete_transaction'
  payload     TEXT NOT NULL,           -- JSON: API 请求体
  status      TEXT DEFAULT 'pending',  -- 'pending' | 'syncing' | 'failed'
  retries     INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL,        -- 时间戳，保证重放顺序
  depends_on  TEXT,                    -- 依赖的操作 ID（为 null 表示无依赖）
  error       TEXT                     -- 最后一次失败的错误信息
);
```

### 6.2 操作写入

**创建交易**:
1. 生成临时 ID: `temp_${uuid()}`
2. 写入队列: `{ type: 'create_transaction', payload: { amount, category_id, note, ... } }`
3. React Query 乐观更新: 用临时 ID 插入缓存
4. UI 立刻显示

**编辑交易**:
1. 入队: `{ type: 'update_transaction', payload: { id, amount?, category_id?, note?, type?, occurred_at? } }`
2. React Query 乐观更新: 修改缓存中该交易的字段
3. UI 立刻反映修改

**删除交易**:
1. 检查队列中该 ID 的 create 操作状态:
   - `status='pending'` → 直接移除该 create 操作，不入队 delete
   - `status='syncing'` → 等待同步完成后再执行删除（入队一个 delete，标记 `depends_on` 为该 create 的 id）
   - 不存在（已同步过）→ 正常入队: `{ type: 'delete_transaction', payload: { id } }`
2. React Query 乐观移除
3. UI 立刻消失

### 6.3 边界处理

| 场景 | 处理方式 |
|------|---------|
| 同步中 app 被杀 | `status='syncing'` 启动时回退为 `pending` |
| 重试 3 次仍失败 | 标记 `status='failed'`，UI 提示用户 |
| 删除 pending 的记录 | 直接移除 create 操作，不发 delete |
| 删除 syncing 的记录 | 入队 delete 并标记依赖，等 create 同步完成后执行 |
| 网络超时后重试 create | 可能导致重复交易（已知限制，BFF 零改动约束下可接受；未来可加幂等 key） |

### 6.4 聊天消息即时显示

**需求**: 用户发送文字/手动记账后，聊天记录必须**立刻**显示对应的消息和账单卡片，不能等待同步。

**问题**: BFF `POST /api/record/manual` 会插入 2 条 `chat_messages`（用户消息 + 账单卡片）作为副作用。如果客户端也乐观插入了聊天消息，同步重放时 BFF 会再插一次，导致重复。

**方案**: 客户端乐观插入 + BFF 加 `skip_chat` 参数

1. 客户端入队时**立刻插入聊天消息到 Zustand**（用户消息 + 账单卡片），UI 即时反映
2. 队列同步时，向 BFF 传递 `skip_chat: true` 参数
3. BFF 收到 `skip_chat: true` 时，只写交易记录，**不写 chat_messages**
4. 这样聊天消息只由客户端产生，不会重复

**BFF 改动** (`apps/api/src/app/api/record/manual/route.ts`):
```
// 现有:
await supabase.from("chat_messages").insert([...]);

// 改为:
if (!body.skip_chat) {
  await supabase.from("chat_messages").insert([...]);
}
```

**ASR/OCR/GLM 场景**: 这些仍走 BFF 原有流程（不传 skip_chat），BFF 正常写聊天消息。用户可以等待这些场景的网络响应。

**TODO**: 后续采用流式对话方式优化 ASR/OCR/GLM 场景的等待体验。

## 7. Rule Engine（规则引擎）

### 7.1 接口

```typescript
interface ParseResult {
  amount: number
  type: 'expense' | 'income'
  categoryName: string
  note: string
}

function parse(text: string): ParseResult | null
```

### 7.2 解析流程

```
Step 1: 提取金额（必须成功，否则返回 null）
  正则: /(\d+\.?\d{0,2})\s*(元|块|¥|￥)?/

Step 2: 判断收支类型
  收入关键词: 工资,薪水,收入,红包,转入,报销,奖金,利息...
  默认: expense

Step 3: 匹配分类（可选，失败则归"其他"）
  关键词表覆盖现有 12 个默认分类

Step 4: 生成备注
  原始文本去掉金额和单位
```

### 7.3 分类 ID 映射

- 来源: React Query 缓存中的 categories 列表
- 方式: `categoryName` 与 `category.name` 精确匹配
- 未找到: 使用"其他"分类的 ID

### 7.4 source 字段说明

客户端在 payload 中传入 `source` 字段，BFF 透传到数据库：

| 来源 | source 值 |
|------|-----------|
| 手动记账 | `manual` |
| 规则引擎解析 | `rule` |
| GLM 文字解析 | `text`（BFF 原有） |
| OCR | `ocr`（BFF 原有） |
| ASR | `asr`（BFF 原有） |

**BFF 改动** (`apps/api/src/app/api/record/manual/route.ts`):
```
// 现有:
{ ...body, user_id: auth.userId, source: "manual" }

// 改为:
{ ...body, user_id: auth.userId, source: body.source ?? "manual" }
```

**Supabase schema 改动**: `source` 字段的 CHECK 约束需新增 `'rule'` 值（如有约束）。

## 8. SyncManager（同步管理器）

### 8.1 触发时机

1. 网络恢复: `offline → online`（NetInfo）
2. App 回到前台: `background → active`（AppState）
3. 新操作入队时，当前有网
4. App 启动时

不做定时轮询。

### 8.2 同步逻辑

```
sync():
  if (正在同步中) return           -- 防并发
  if (无网络) return

  operations = queue.getPending()   -- 按 created_at 升序
  for (op of operations):
    -- 依赖检查: 如果依赖的操作还在队列中，跳过本次
    if (op.depends_on && queue.exists(op.depends_on)):
      continue

    queue.markSyncing(op.id)
    try:
      if op.type === 'create_transaction':
        response = POST /api/record/manual (op.payload + { skip_chat: true })
        → 用真实 ID 替换 React Query 缓存中的临时 ID
        → 更新依赖此操作的 delete/update 的 payload.id 为真实 ID
      if op.type === 'update_transaction':
        PATCH /api/transactions/{op.payload.id} (op.payload)
      if op.type === 'delete_transaction':
        DELETE /api/transactions/{op.payload.id}
      queue.remove(op.id)
    catch (error):
      if (网络错误):
        queue.markPending(op.id)    -- 回退
        break                       -- 后面也不试了
      if (业务错误):
        op.retries >= 3:
          queue.markFailed(op.id)
          -- 级联失败: 依赖此操作的也标记为 failed
          queue.markFailedByDependency(op.id)
        否则 → markPending

  invalidateQueries(['transactions', 'chat-messages'])
```

**depends_on 工作流程**:
```
用户离线创建 tx (temp_123) → create 入队 (id=op_A, status=pending)
用户删除 temp_123          → create 仍在 syncing
                           → delete 入队 (id=op_B, depends_on=op_A)

同步时:
  op_A (create): 执行成功 → 服务端返回真实 ID real_456
    → 更新 op_B 的 payload.id 为 real_456
    → 删除 op_A
  op_B (delete): depends_on op_A 已不存在 → 可执行
    → DELETE /api/transactions/real_456 → 成功

如果 op_A 失败 3 次:
  op_A → markFailed
  op_B → markFailed (级联)
  → UI 提示用户处理
```

### 8.3 用户反馈

| 状态 | UI 表现 |
|------|---------|
| 队列有待同步项 | 状态栏云+箭头图标 |
| 同步进行中 | 图标动画 |
| 全部完成 | 图标消失 |
| 有失败操作 | 红色提示，可重试/删除 |

## 9. App 启动恢复

```
App 启动
  → expo-sqlite 初始化（CREATE TABLE IF NOT EXISTS）
  → status='syncing' 的操作回退为 'pending'
  → SyncManager 启动
     → 有网 → sync()
     → 无网 → 等待网络恢复
  → React Query 从 AsyncStorage 恢复缓存（现有逻辑不变）
```

## 10. 现有模块角色变化

| 模块 | 现在 | 重构后 |
|------|------|--------|
| React Query | 读 + 写 | 读 + 乐观更新 |
| AsyncStorage | RQ 缓存持久化 | 不变 |
| Zustand (chatStore) | 聊天消息状态 | 不变 |
| apiFetch | 所有 API 调用 | 用于 GLM/ASR/OCR 和队列同步 |

## 11. 新增代码清单

```
apps/mobile/src/lib/rule-engine/
  ├── index.ts              -- 入口: parse(text)
  ├── extract-amount.ts     -- 金额提取            TODO (human)
  ├── match-category.ts     -- 分类匹配            TODO (human)
  └── keywords.ts           -- 关键词表             TODO (human)

apps/mobile/src/lib/queue/
  └── operation-queue.ts    -- 队列 CRUD (expo-sqlite)

apps/mobile/src/lib/sync/
  ├── sync-manager.ts       -- 核心同步逻辑
  └── use-sync.ts           -- Hook: 监听网络/AppState

apps/mobile/src/hooks/
  └── useOfflineQueue.ts    -- 队列操作 Hook        TODO (human)
```

## 12. BFF 改动清单（最小化）

仅改动 `apps/api/src/app/api/record/manual/route.ts`:

1. **source 透传**: `source: body.source ?? "manual"`（不再硬编码）
2. **skip_chat 参数**: `if (!body.skip_chat) { await supabase.from("chat_messages").insert([...]); }`

其余不变:
- `packages/` — shared/ai 包不变（需在 shared types 中新增 `source: "rule"` 类型）
- `supabase/` — 如有 source CHECK 约束需新增 `'rule'`
- React Query 读取逻辑不变
- AsyncStorage 持久化不变

## 13. 已知限制

| 限制 | 说明 | 影响 |
|------|------|------|
| create 重试可能产生重复 | 网络超时后重试，BFF 无幂等检查 | 极低概率；未来可通过幂等 key 解决 |
| ASR/OCR/GLM 仍需等待 | 这些场景需要云端处理 | TODO: 后续引入流式对话优化等待体验 |

## 14. TODO (human) 标注说明

以下模块标记为 `TODO (human)`，建议由用户亲手编写，Claude 提供指导和 review:

1. **Rule Engine 核心** (`extract-amount.ts`, `match-category.ts`, `keywords.ts`)
   - 原因: 规则引擎是纯逻辑代码，非常适合 TDD 练习。先写测试再实现。
   - 建议: 从 `extract-amount.ts` 开始，用正则提取金额，边写测试边完善边界 case。

2. **useOfflineQueue Hook**
   - 原因: 这是 React Hook + SQLite 的组合，是理解 offline-first 模式的关键。
   - 建议: 先实现 `enqueue` 和 `getPending`，再加 `remove` 和 `markFailed`。

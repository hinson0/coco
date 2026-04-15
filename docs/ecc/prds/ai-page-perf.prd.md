# AI 聊天页进入性能优化

## Problem Statement

用户点击 AI 按钮进入聊天页时，有时流畅、有时卡顿，体验不一致。核心原因是数据加载
在组件挂载后才开始（无预取），且 SQLite 查询缺乏最优复合索引，同时
`initDatabase()` 每次启动都执行全量迁移扫描，在 I/O 竞争时会拉高首次渲染延迟。

## Evidence

- `useLocalChatMessages` 查询：`WHERE user_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 30`
  现有索引为单列 `idx_chat_messages_user_id(user_id)` + `idx_chat_messages_created_at(created_at DESC)`，SQLite 只能选其一，另一个条件需全表过滤
- `buildListItems` 和 `useLocalChatMessages` 各自调用一次 `Array.reverse()`，共两次 O(n) 翻转
- `BottomTabBar` 的 AI 按钮使用 `onPress` → `router.push("/")`，组件挂载后查询才开始，
  而 `onPressIn` 比 `onPress` 平均早 **100-200ms** 触发
- `initDatabase()` 每次 App 启动执行 ~15 条 `PRAGMA table_info` + `ALTER TABLE`（即使 schema 已是最新），
  在低端设备 / I/O 忙时可增加 50-300ms 启动延迟
- `ChatInputBar` 在 mount 时立即初始化 `useVoiceRecorder`（音频会话），即便用户不使用语音功能

## Proposed Solution

分四个阶段：
1. **索引优化**：添加复合部分索引，让聊天消息查询走最优执行计划
2. **预取优化**：在 AI 按钮 `onPressIn` 时提前触发 React Query 预取
3. **冗余消除**：消除双重 `reverse()`，简化数据流
4. **懒加载**：语音录音器延迟初始化，只在用户切换语音模式时启动

## Key Hypothesis

我们相信通过复合索引 + 按钮预取，可以将 AI 页**可见内容出现时间**（TTI）稳定压缩，
使点击后感知延迟从"有时卡顿"变为"始终顺滑"。
我们将在 **Dev 模式的 `loadMs` 指标**（已内置于页面标题）中验证效果。

## What We're NOT Building

- 服务端 AI 响应缓存 / 流式返回 — 本次只优化**进入速度**，不优化 AI 推理延迟
- 骨架屏 / Skeleton UI — 当前已有欢迎消息兜底，无需新增骨架
- 消息分页策略重构 — INITIAL_LIMIT=30 已合理，不调整

## Success Metrics

| 指标 | 目标 | 测量方法 |
|------|------|----------|
| AI 页 `loadMs`（Dev 标题显示） | 稳定 < 200ms（从 tap 到首屏内容） | 页面内置计时器 |
| 冷启动进入延迟 | 无明显白屏（< 100ms 显示框架） | 肉眼 + Perf monitor |
| 从其他 Tab 切换延迟 | 即时（< 50ms，命中 React Query 缓存） | 肉眼感知 |

## Open Questions

- [ ] `useVoiceRecorder` 内部是否在 mount 时立即调用原生音频 API（需 hook 内部确认）
- [ ] `initDatabase` 迁移扫描的实际耗时 — 是否值得加版本号跳过

---

## Users & Context

**Primary User**
- **Who**: CoCo App 日常用户，每天多次进入 AI 记账页
- **Current behavior**: 点 AI 按钮，偶尔等待 0.5-1s 才看到内容
- **Trigger**: 想快速记一笔账时点 AI 按钮
- **Success state**: 点击即刻看到聊天界面，无感知等待

**Job to Be Done**
当我想快速记账时，我想要立刻进入聊天界面，这样我不会因为等待而分心或放弃记账。

**Non-Users**
新用户首次安装体验不在本次范围内（首次 initDatabase 本身有种子数据写入，特殊处理）。

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | 添加复合部分索引 `(user_id, created_at DESC) WHERE deleted_at IS NULL` | 直接覆盖高频查询执行计划 |
| Must | AI 按钮 `onPressIn` 触发 React Query 预取 | 提前 150ms 启动查询，命中缓存时进入即显示 |
| Should | 消除双重 `reverse()` | 代码清晰度 + 轻微性能提升 |
| Should | `useVoiceRecorder` 懒初始化 | 减少 mount 阶段的副作用 |
| Could | `initDatabase` 加 schema 版本号跳过迁移扫描 | 需确认实际耗时再决定 |
| Won't | AI 响应流式输出 | 超出本次范围 |

### MVP Scope

Phase 1（索引）+ Phase 2（预取）即可达到目标，后两个 Phase 是锦上添花。

### User Flow（优化后）

```
用户手指触碰 AI 按钮（onPressIn）
  → React Query prefetchQuery 发起 SQLite 查询（后台）
  → 手指抬起（onPress，~150ms 后）
  → router.push("/") → 组件挂载
  → React Query 命中 in-flight 查询 or 已完成的缓存
  → FlatList 立刻渲染数据（无等待）
```

---

## Technical Approach

**Feasibility**: HIGH — 全部改动都在现有模式内，无新依赖

### 架构说明

#### Phase 1: 复合部分索引

在 `apps/mobile/lib/db/schema.ts` 的 `runMigrations()` 中添加：

```sql
-- 替代现有两个单列索引，覆盖完整查询计划
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_active
ON chat_messages(user_id, created_at DESC)
WHERE deleted_at IS NULL
```

查询 `WHERE user_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 30`
将完全走这个索引，无需额外过滤或排序。

**注意**：SQLite 部分索引（Partial Index）在 `WHERE deleted_at IS NULL` 过滤列存在
时才生效。现有 schema 已有 `deleted_at` 列，兼容。

#### Phase 2: 按钮预取

在 `BottomTabBar.tsx` 的 AI 按钮上：

```typescript
// 从 OfflineContext 取 db/userId，从 QueryClient 触发预取
const handleAiPressIn = useCallback(() => {
  if (!db || !userId) return;
  // 预取聊天消息
  queryClient.prefetchQuery({
    queryKey: ["chat-messages", userId, INITIAL_LIMIT],
    queryFn: () => fetchChatMessagesQuery(db, userId, INITIAL_LIMIT),
    staleTime: Infinity,
  });
  // 预取分类（categories 通常已缓存，prefetch 是幂等的）
  queryClient.prefetchQuery({
    queryKey: ["categories", userId],
    queryFn: () => fetchCategoriesQuery(db, userId),
    staleTime: Infinity,
  });
}, [db, userId, queryClient]);
```

需要将 `useLocalChatMessages` 和 `useLocalCategories` 的 `queryFn` 逻辑提取为
可复用的纯函数，供预取复用。

#### Phase 3: 消除双重 reverse()

当前数据流：
```
SQLite DESC → useLocalChatMessages .reverse() → ASC
ASC → buildListItems → .reverse() → DESC（给 FlatList inverted）
```

修正后：
```
SQLite DESC → useLocalChatMessages 直接返回 DESC（删掉 .reverse()）
DESC → buildListItems 按 DESC 顺序构建（最新在前加 separator，结果不再 reverse）
```

#### Phase 4: useVoiceRecorder 懒初始化

在 `ChatInputBar.tsx` 中，将 `useVoiceRecorder` 的调用从无条件 mount 改为：
只有当 `voiceMode === true` 时才初始化（或使用 Suspense/条件 mount）。

### Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 部分索引在老版本 SQLite（expo-sqlite）不支持 | LOW | expo-sqlite 底层是 SQLite 3.x，部分索引自 3.8 已支持 |
| prefetchQuery 在 db/userId 尚未就绪时调用 | LOW | 加 `if (!db || !userId) return` guard |
| 消除 reverse() 导致 buildListItems 逻辑错误 | MEDIUM | 需要同步更新 separator 插入逻辑，写单元测试覆盖 |
| useVoiceRecorder 懒加载破坏录音状态提升 | LOW | 已知录音状态从 ChatInputBar 提升到 ChatScreen，懒加载需保持接口兼容 |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | 索引优化 | 添加复合部分索引 + 验证查询计划 | complete | - | - | docs/ecc/plans/completed/ai-page-perf-phase1.plan.md |
| 2 | 预取优化 | 提取 queryFn 为纯函数 + 按钮 onPressIn 预取 | complete | - | 1 | - |
| 3 | 冗余消除 | 删掉双重 reverse()，修正 buildListItems 逻辑 | complete | with 2 | 1 | - |
| 4 | 懒加载语音 | useVoiceRecorder 延迟到语音模式切换时初始化 | pending | - | 2, 3 | - |

### Phase Details

**Phase 1: 索引优化**
- **Goal**: 聊天消息查询走最优执行计划
- **Scope**: 仅修改 `schema.ts` 的 `runMigrations()`，添加一条 `CREATE INDEX`
- **Success signal**: SQLite `EXPLAIN QUERY PLAN` 显示使用新复合索引

**Phase 2: 预取优化**
- **Goal**: 组件挂载前数据已在 React Query 缓存中
- **Scope**: 提取 queryFn 纯函数（新文件 `lib/db/queries.ts`）；修改 `BottomTabBar.tsx` 添加 `onPressIn`
- **Success signal**: Dev 模式 `loadMs` 稳定 < 100ms（从其他 Tab 切入时）

**Phase 3: 冗余消除**
- **Goal**: 消除两次 O(n) 翻转，统一数据方向约定
- **Scope**: 修改 `useLocalChatMessages` 的返回顺序（删 `.reverse()`）；修改 `buildListItems` 适配 DESC 输入
- **Success signal**: 现有测试（statsUtils, insights 单元测试）仍全部通过；手动验证消息顺序正确

**Phase 4: 懒加载语音**
- **Goal**: 减少 mount 阶段音频会话初始化开销
- **Scope**: 仅修改 `ChatInputBar.tsx` 的 `useVoiceRecorder` 调用时机
- **Success signal**: 进入 AI 页不触发音频会话（Xcode Instruments 确认）

### Parallelism Notes

Phase 2 和 Phase 3 可以并行开发（分别修改不同文件），但都依赖 Phase 1 的索引先合并，
因为 Phase 2 的 queryFn 提取需要最终的 schema 稳定。

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| 使用部分索引而非普通复合索引 | 部分索引 `WHERE deleted_at IS NULL` | 普通复合索引 `(user_id, deleted_at, created_at)` | 部分索引更小、更快，且与查询完全匹配；deleted_at 列基本都是 NULL |
| 预取放在 BottomTabBar 而非 ChatScreen | BottomTabBar.onPressIn | ChatScreen useEffect 提前 | onPressIn 在路由跳转前触发，是唯一能超前的时机 |
| 提取 queryFn 为纯函数（lib/db/queries.ts） | 新文件 | 在 BottomTabBar 内联 | 避免跨层依赖，queryFn 可被 hook 和 prefetch 复用 |

---

## Research Summary

**技术背景**
- SQLite 部分索引（Partial Index）自 3.8.0 支持，expo-sqlite 底层 SQLite 版本 ≥ 3.39
- React Query `prefetchQuery` 与 `useQuery` 共享缓存，prefetch 完成后 useQuery 直接命中
- `onPressIn` 在 iOS 上比 `onPress` 早约 100-200ms（手指触碰即触发，抬起才是 press）

**代码现状**
- `chat_messages` 已有 `idx_chat_messages_user_id` + `idx_chat_messages_created_at` 两个单列索引，不满足复合查询
- `BottomTabBar.tsx:AIButton` 只有 `onPress` 无 `onPressIn`
- `useLocalChatMessages` queryFn 内联在 hook 内，未导出为纯函数

---

*Generated: 2026-04-15*
*Status: DRAFT — 待实现验证*

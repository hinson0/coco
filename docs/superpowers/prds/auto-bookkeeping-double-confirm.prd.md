# 自动记账重复确认弹窗 Bug 修复

## Problem Statement

自动记账功能在微信转账后，确认弹窗会连续弹出 2 次，导致用户确认 2 次、创建 2 条重复交易记录。根因是 React Query 的异步 refetch 与 UI 状态切换之间的竞态条件——`showNext()` 重置了 UI 状态但 `pendingList` 仍持有 stale 数据，useEffect 误判为还有待处理项并再次弹窗。

## Evidence

- 用户复现：每次微信转账后，coco 通知显示 1 条，但确认弹窗弹出 2 次
- App 在后台时稳定复现，100% 复现率（"不论怎么样都是2条"）
- 之前的 [4条] 解析 bug 已修复，2 条问题是不同的 bug

## Root Cause

文件：`apps/mobile/components/auto-bookkeeping/PendingConfirmOverlay.tsx:24-29`

```typescript
useEffect(() => {
  if (!visible && pendingList.length > 0 && !currentPending) {
    setCurrentPending(pendingList[0]);
    setVisible(true);
  }
}, [pendingList, visible, currentPending]);
```

时序：
1. `handleConfirm()` → `confirmMutation.mutateAsync()` → DB 更新 status='confirmed'
2. mutation `onSuccess` → `invalidateQueries()` → 异步 refetch 开始
3. `showNext()` → `setVisible(false)`, `setCurrentPending(null)`
4. React 重新渲染 → `pendingList` 仍为 stale 旧数据（refetch 未完成）
5. useEffect 条件全部为 true → 再次弹窗 ← **BUG**

## Proposed Solution

在 `showNext()` 之前，使用 `queryClient.setQueryData()` 乐观更新（optimistic update）从缓存中移除已确认/已驳回的项，确保下一次 render 时 `pendingList` 不再包含该记录。

## Key Hypothesis

我们相信通过乐观更新 React Query 缓存，可以消除 stale 数据导致的重复弹窗。验证标准：微信转账后确认弹窗只弹 1 次，只创建 1 条交易。

## What We're NOT Building

- 不改动去重逻辑（已验证正确）
- 不改动原生层 Kotlin 代码
- 不改动 parser 或 pending-queue 数据层

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| 确认弹窗次数 | 每笔交易仅 1 次 | 手动测试：微信转账 3 次 |
| 创建交易数 | 每笔 pending 仅 1 条交易 | 检查 transactions 表 |
| 回归 | 无新增 bug | 正常记账流程端到端测试 |

## Open Questions

- [x] 根因已确认：React Query stale data + useEffect 竞态
- [ ] 是否需要补充自动化测试覆盖此场景

---

## Users & Context

**Primary User**
- **Who**: 使用 coco 自动记账的 Android 用户
- **Current behavior**: 微信转账后被要求确认 2 次，创建 2 条重复记录
- **Trigger**: 微信转账 → 通知到达 → 用户打开 app 确认
- **Success state**: 1 次确认 → 1 条交易，干净利落

**Job to Be Done**
当我微信转账后看到 coco 提醒，我想要一次点击确认记账，而不是重复操作。

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | 乐观更新缓存，移除已确认/已驳回项 | 消除 stale 数据竞态 |
| Must | handleDismiss 同样应用乐观更新 | 驳回流程有同样的 bug |
| Should | 添加防重复确认保护（confirming 状态锁） | 防止快速连点 |
| Won't | 改动去重逻辑或原生层代码 | 已验证正确 |

### MVP Scope

修改 `PendingConfirmOverlay.tsx` 中的 `handleConfirm` 和 `handleDismiss`，在调用 `showNext()` 前乐观移除当前项。

### User Flow (修复后)

```
通知到达 → 弹窗显示 → 用户确认
  → 缓存立即移除该项 → showNext
  → pendingList 为空 → 不再弹窗 ✓
  → 后台 refetch 确认数据一致
```

---

## Technical Approach

**Feasibility**: HIGH — 单文件修改，纯 UI 层

**Architecture Notes**
- 使用 React Query 的 `setQueryData` 进行乐观更新（官方推荐模式）
- 不需要改动 mutation hook 的 `onSuccess`，两者互补

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 乐观更新与 refetch 冲突 | LOW | setQueryData 后 invalidateQueries 会用服务端数据覆盖，是预期行为 |

---

## Implementation Plan

### 修改文件

**`apps/mobile/components/auto-bookkeeping/PendingConfirmOverlay.tsx`**

1. 获取 `queryClient` 和 `userId`
2. 在 `handleConfirm` 中，`showNext()` 之前加入乐观更新：
   ```typescript
   qc.setQueryData(
     ["pending-notifications", userId],
     (old: PendingNotification[] | undefined) =>
       old?.filter(p => p.id !== currentPending.id) ?? []
   );
   ```
3. `handleDismiss` 同理
4. 可选：添加 `isProcessing` ref 防止连点

### 验证步骤

1. `npx expo run:android` 重新构建
2. 微信转账 0.01 元 × 3 次
3. 每次确认弹窗只弹 1 次
4. 检查交易列表无重复

---

*Generated: 2026-04-13*
*Status: READY FOR IMPLEMENTATION*

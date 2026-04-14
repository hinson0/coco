# Plan: 修复自动记账重复确认弹窗

## Summary
React Query 异步 refetch 与 UI 状态重置存在竞态：`showNext()` 清空 UI 状态后，`pendingList` 仍持有 stale 数据，useEffect 误触发第二次弹窗。通过在 `showNext()` 前乐观更新缓存来消除竞态。

## User Story
As a coco 自动记账用户,
I want 微信转账后确认弹窗只弹一次,
So that 我不会因为重复确认而产生重复交易记录。

## Problem → Solution
确认后 pendingList stale 数据触发二次弹窗 → 乐观更新缓存，确认/驳回时立即从 pendingList 移除该项

## Metadata
- **Complexity**: Small
- **Source PRD**: `.claude/PRPs/prds/auto-bookkeeping-double-confirm.prd.md`
- **PRD Phase**: 单阶段 bug 修复
- **Estimated Files**: 1

---

## UX Design

### Before
```
微信转账 → coco 通知(1条)
  → 用户打开 app
  → 弹窗1: "确认记账 ¥0.01？" → 用户确认
  → 弹窗2: "确认记账 ¥0.01？" → 用户再次确认 ← BUG
  → 结果：2条交易记录
```

### After
```
微信转账 → coco 通知(1条)
  → 用户打开 app
  → 弹窗: "确认记账 ¥0.01？" → 用户确认
  → 结束，不再弹窗
  → 结果：1条交易记录
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 确认弹窗 | 弹出 2 次 | 弹出 1 次 | 乐观更新消除 stale 竞态 |
| 驳回弹窗 | 可能也弹 2 次 | 弹出 1 次 | 同样修复 |
| 交易记录 | 每笔产生 2 条 | 每笔产生 1 条 | 不再重复创建 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `apps/mobile/components/auto-bookkeeping/PendingConfirmOverlay.tsx` | all | Bug 所在文件，修改目标 |
| P1 | `apps/mobile/hooks/usePendingNotifications.ts` | 11-25, 41-59 | query key 定义 + mutation 的 onSuccess 逻辑 |
| P2 | `apps/mobile/lib/auto-bookkeeping/pending-queue.ts` | 1-18 | PendingNotification 类型定义 |

## External Documentation

No external research needed — feature uses established React Query optimistic update pattern.

---

## Patterns to Mirror

### QUERY_KEY_CONVENTION
```typescript
// SOURCE: hooks/usePendingNotifications.ts:11,16
const QUERY_KEY = "pending-notifications";
// queryKey 形式: [QUERY_KEY, userId]
return useQuery({
  queryKey: [QUERY_KEY, userId],
  ...
});
```

### MUTATION_WITH_INVALIDATION
```typescript
// SOURCE: hooks/usePendingNotifications.ts:41-59
return useMutation({
  mutationFn: async ({ pendingId, transactionId }) => {
    await confirmPending(db, pendingId, transactionId);
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: [QUERY_KEY] });
  },
});
```

### SHOW_NEXT_PATTERN
```typescript
// SOURCE: components/auto-bookkeeping/PendingConfirmOverlay.tsx:42-46
const showNext = useCallback(() => {
  setVisible(false);
  setCurrentPending(null);
}, []);
```

### OFFLINE_CONTEXT_USAGE
```typescript
// SOURCE: hooks/usePendingNotifications.ts:14
const { db, userId } = useOfflineContext();
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/mobile/components/auto-bookkeeping/PendingConfirmOverlay.tsx` | UPDATE | 添加乐观更新，消除 stale 竞态 |

## NOT Building

- 不改动 `hooks/usePendingNotifications.ts`（mutation hook 保持不变）
- 不改动 `hooks/useAutoBookkeeping.ts`（通知处理逻辑正确）
- 不改动 `lib/auto-bookkeeping/dedup.ts`（去重逻辑正确）
- 不改动 Kotlin 原生层代码
- 不添加新文件

---

## Step-by-Step Tasks

### Task 1: 引入 useQueryClient 和 useOfflineContext

- **ACTION**: 在 `PendingConfirmOverlay` 组件内获取 `queryClient` 和 `userId`，用于乐观更新缓存
- **IMPLEMENT**:
  ```typescript
  import { useQueryClient } from "@tanstack/react-query";
  import { useOfflineContext } from "@/lib/offline-context";
  // ...
  export function PendingConfirmOverlay() {
    const { data: pendingList = [] } = usePendingNotifications();
    const qc = useQueryClient();
    const { userId } = useOfflineContext();
    // ... rest unchanged
  ```
- **MIRROR**: OFFLINE_CONTEXT_USAGE, QUERY_KEY_CONVENTION
- **IMPORTS**: `useQueryClient` from `@tanstack/react-query`, `useOfflineContext` from `@/lib/offline-context`
- **GOTCHA**: `userId` 可能为 null（未登录），但此组件只在已登录状态下渲染，所以 queryKey 中 userId 总是有值
- **VALIDATE**: TypeScript 编译通过，无类型错误

### Task 2: 提取乐观移除辅助函数

- **ACTION**: 创建一个局部函数 `removePendingFromCache`，将指定 id 从 React Query 缓存中移除
- **IMPLEMENT**:
  ```typescript
  const removePendingFromCache = useCallback(
    (pendingId: string) => {
      qc.setQueryData(
        ["pending-notifications", userId],
        (old: readonly PendingNotification[] | undefined) =>
          old?.filter((p) => p.id !== pendingId) ?? [],
      );
    },
    [qc, userId],
  );
  ```
- **MIRROR**: QUERY_KEY_CONVENTION（queryKey 必须是 `["pending-notifications", userId]`）
- **IMPORTS**: 无新增（已在 Task 1 引入）
- **GOTCHA**: `setQueryData` 的回调参数类型必须与 `useQuery` 的返回类型一致（`readonly PendingNotification[]`）。query key 必须与 `usePendingNotifications` 中的完全匹配，包含 `userId`
- **VALIDATE**: TypeScript 编译通过

### Task 3: 修改 handleConfirm —— 在 showNext 前乐观更新

- **ACTION**: 在 `handleConfirm` 中，`showNext()` 之前调用 `removePendingFromCache`
- **IMPLEMENT**:
  ```typescript
  const handleConfirm = useCallback(
    async (categoryId: string, note: string) => {
      if (!currentPending) return;

      const txId = await createTransaction.mutateAsync({
        category_id: categoryId,
        amount: currentPending.amount,
        type: currentPending.type,
        note,
        occurred_at: new Date(
          currentPending.notification_timestamp,
        ).toISOString(),
        source: "notification",
        raw_input: currentPending.raw_text ?? undefined,
      });

      await confirmMutation.mutateAsync({
        pendingId: currentPending.id,
        transactionId: txId,
      });

      const sourceLabel =
        currentPending.source === "wechat" ? "微信支付" : "支付宝";
      addMessage.mutate({
        role: "assistant",
        content_type: "bill_card",
        content: JSON.stringify({
          id: txId,
          amount: currentPending.amount,
          type: currentPending.type,
          category_id: categoryId,
          note,
          source: sourceLabel,
          occurred_at: new Date(
            currentPending.notification_timestamp,
          ).toISOString(),
        }),
        transaction_id: txId,
      });

      removePendingFromCache(currentPending.id);  // ← 新增
      showNext();
    },
    [currentPending, createTransaction, confirmMutation, addMessage, removePendingFromCache, showNext],
  );
  ```
- **MIRROR**: SHOW_NEXT_PATTERN
- **IMPORTS**: 无新增
- **GOTCHA**: `removePendingFromCache` 必须在 `showNext()` 之前调用。顺序至关重要：先更新缓存（同步），再重置 UI 状态，这样下一次 render 时 useEffect 看到的 pendingList 已不含该项
- **VALIDATE**: 微信转账后确认弹窗只弹 1 次

### Task 4: 修改 handleDismiss —— 同样加乐观更新

- **ACTION**: `handleDismiss` 存在同样的竞态问题，需要同样修复
- **IMPLEMENT**:
  ```typescript
  const handleDismiss = useCallback(async () => {
    if (currentPending) {
      await dismissMutation.mutateAsync(currentPending.id);
      removePendingFromCache(currentPending.id);  // ← 新增
    }
    showNext();
  }, [currentPending, dismissMutation, removePendingFromCache, showNext]);
  ```
- **MIRROR**: SHOW_NEXT_PATTERN
- **IMPORTS**: 无新增
- **GOTCHA**: `removePendingFromCache` 在 `dismissMutation` 完成后、`showNext` 前调用
- **VALIDATE**: 驳回操作也不会触发重复弹窗

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| 确认后 pendingList 缓存被更新 | 1 条 pending → confirm | 缓存变为 [] | No |
| 驳回后 pendingList 缓存被更新 | 1 条 pending → dismiss | 缓存变为 [] | No |
| 多条 pending 确认第一条 | 3 条 pending → confirm 第一条 | 缓存剩余 2 条 | No |
| currentPending 为 null 时确认 | null → confirm | 无操作 | Yes |

### Edge Cases Checklist
- [x] 单条 pending：确认后不再弹窗
- [x] 多条 pending：确认第一条后自动弹出第二条（非重复）
- [x] 快速连续确认：不会创建重复交易
- [x] 驳回场景：同样不重复弹窗
- [ ] 网络断开时（离线）：不影响，数据全在本地 SQLite

---

## Validation Commands

### Static Analysis
```bash
cd /Users/a114514/coco/.claude/worktrees/feat-auto && npx tsc --noEmit --project apps/mobile/tsconfig.json
```
EXPECT: Zero type errors

### Manual Validation
- [ ] `npx expo run:android` 重新构建（如果只改 TS 无需重编原生）
- [ ] 微信给好友转账 ¥0.01
- [ ] 等待 coco 通知出现
- [ ] 点击进入 app
- [ ] 确认弹窗**只弹 1 次**
- [ ] 检查账单列表只有 **1 条**记录
- [ ] 重复测试 3 次确认稳定
- [ ] 测试驳回流程（也只弹 1 次）

---

## Acceptance Criteria
- [ ] 微信转账后确认弹窗只弹 1 次
- [ ] 每笔 pending 只创建 1 条交易
- [ ] 驳回流程同样只弹 1 次
- [ ] 多条 pending 的队列行为正常（第一条处理完自动弹第二条）
- [ ] TypeScript 编译零错误

## Completion Checklist
- [ ] 代码遵循 React Query 乐观更新模式
- [ ] query key 与 usePendingNotifications 完全一致
- [ ] useCallback 依赖数组完整
- [ ] 无硬编码值
- [ ] 无不必要的 scope 扩展

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| setQueryData 的 queryKey 与实际 queryKey 不匹配 | LOW | 乐观更新无效，bug 仍存在 | queryKey 必须是 `["pending-notifications", userId]`，与 hook 中一致 |
| 多条 pending 场景下乐观更新误删 | VERY LOW | 少弹窗 | filter 只移除当前 id，不影响其他 |

## Notes
- `setQueryData` 是同步操作，在同一 tick 内完成缓存更新
- mutation 的 `onSuccess` 中的 `invalidateQueries` 仍然保留，作为最终一致性保障
- 这是纯 JS 层修改，不需要 `npx expo run:android` 重编原生代码，Metro 热更新即可

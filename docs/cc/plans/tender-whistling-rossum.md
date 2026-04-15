# 修复自动记账误触发 + 架构对齐

## Context

用户收到一条普通微信聊天消息（"openrouter 这个网站有很多贵的 LLM API"），CoCo 弹出了"已自动记账"系统通知，误导用户以为被记了一笔账。

深层分析发现三个架构问题：

1. **Android 层通知乱发**：`showAutoBookkeepingNotification()` 金额提取失败时仍发通知（已修复）
2. **pending 队列是死代码**：`processNotification()` 绕过 pending queue，直接写入 `transactions` 表；`PendingConfirmOverlay` 已实现但未挂载；`addPending()` 从未被调用
3. **dedup.ts 未被使用**：`processNotification()` 用内联 SQL 去重，而专门设计的 `isDuplicate()` 无人调用
4. **parser.ts fallback 过宽**：任何含金额的微信/支付宝通知（无论 title 是否是支付类、无论是否有收支关键词）都默认记为"支出"

---

## 已完成的修复

### ✅ Task 1 — Android 层：金额缺失时提前返回

**文件**：`modules/expo-auto-bookkeeping/android/.../NotificationListenerServiceImpl.kt`（第 147–197 行已修改）

金额提取失败时直接 return，不发"已自动记账"通知。

### ✅ Task 2 — parser.test.ts：补充 URL 消息测试用例

已新增两个测试用例，24 个用例全部通过。

---

## 待实现的修复

### Task 3 — parser.ts：增加 title 白名单 + 移除 fallback

**文件**：`apps/mobile/lib/auto-bookkeeping/parser.ts`

**改动 1**：在 `combined` 拼接之前，增加 title 白名单校验：
```typescript
// 新增常量
const PAYMENT_TITLE_KEYWORDS = /微信支付|支付宝/;

// parseNotification() 内，source 确认后、金额匹配前
if (!PAYMENT_TITLE_KEYWORDS.test(title)) return null;
```

**改动 2**：移除无关键词时兜底为 expense 的逻辑：
```typescript
// 修改前
} else {
  type = "expense";  // fallback
}

// 修改后
} else {
  return null;  // 无明确收支方向，不记账
}
```

**同步修改测试** (`apps/mobile/lib/auto-bookkeeping/__tests__/parser.test.ts`)：
- `无收支关键词默认为支出`：text=`"交易金额50.00元"`, title=`"微信支付"` → 期望改为 null（没有收支关键词，不应记账）
- `title 中包含支付关键词`：text=`"¥0.01"`, title=`"微信支付"` → 期望改为 null（纯金额、无语义，不应记账）
- 新增：title=`"爆米花"` 但 text 有金额 → 期望 null（title 不在白名单）

---

### Task 4 — useAutoBookkeeping.ts：接入 pending queue + dedup.ts

**文件**：`apps/mobile/hooks/useAutoBookkeeping.ts`

**目标**：将 `processNotification()` 从"直接记账"改为"存入 pending 队列"。

**当前流程**：
```
解析 → SQL去重 → 查"购物"分类 → INSERT transactions → INSERT chat_messages → push
```

**修改后流程**：
```
解析 → dedup.ts去重(基于pending队列) → addPending() → invalidate pending查询
```

**具体改动**：
1. 导入 `addPending`、`getRecentForDedup`（from `pending-queue.ts`）
2. 导入 `isDuplicate`（from `dedup.ts`）
3. 重写 `processNotification()` 核心逻辑：
   - 去掉：查"购物"分类、INSERT transactions、INSERT chat_messages、push 调用
   - 加上：`getRecentForDedup()` + `isDuplicate()` 去重
   - 加上：`addPending()` 写入 pending 队列
   - 加上：`queryClient.invalidateQueries({ queryKey: ['pendingNotifications', userId] })`

关键代码路径（`useAutoBookkeeping.ts`，大约第 43–158 行全部替换）：
```typescript
// 简化后的 processNotification
const parsed = parseNotification(event.packageName, event.title, event.text);
if (!parsed) return;

const recentItems = await getRecentForDedup(db, userId, event.timestamp);
const incoming = {
  amount: parsed.amount,
  source: parsed.source,
  timestamp: event.timestamp,
  rawText: parsed.rawText,
};
if (isDuplicate(incoming, recentItems)) return;

await addPending(db, userId, parsed, event.timestamp);
queryClient.invalidateQueries({ queryKey: ['pendingNotifications', userId] });
```

---

### Task 5 — _layout.tsx：挂载 PendingConfirmOverlay

**文件**：`apps/mobile/app/_layout.tsx`

**改动**：在 `AutoBookkeepingRunner` 旁边加 `<PendingConfirmOverlay />`：
```tsx
// 修改前
function AutoBookkeepingRunner() {
  useAutoBookkeeping();
  return null;
}

// 修改后
function AutoBookkeepingRunner() {
  useAutoBookkeeping();
  return <PendingConfirmOverlay />;
}
```

导入 `PendingConfirmOverlay` from `'@/components/auto-bookkeeping/PendingConfirmOverlay'`

---

## 关键文件一览

| 文件 | Task | 状态 |
|------|------|------|
| `modules/.../NotificationListenerServiceImpl.kt` | 1 | ✅ 已完成 |
| `apps/mobile/lib/auto-bookkeeping/__tests__/parser.test.ts` | 2 | ✅ 已完成 |
| `apps/mobile/lib/auto-bookkeeping/parser.ts` | 3 | 待实现 |
| `apps/mobile/lib/auto-bookkeeping/__tests__/parser.test.ts` | 3 | 待修改（2个期望值） |
| `apps/mobile/hooks/useAutoBookkeeping.ts` | 4 | 待实现 |
| `apps/mobile/app/_layout.tsx` | 5 | 待实现 |

**只读参考文件**（不需要修改）：
- `apps/mobile/lib/auto-bookkeeping/pending-queue.ts` — `addPending`, `getRecentForDedup` API
- `apps/mobile/lib/auto-bookkeeping/dedup.ts` — `isDuplicate`, `DedupItem`
- `apps/mobile/components/auto-bookkeeping/PendingConfirmOverlay.tsx` — 已实现完整弹窗逻辑

---

## 验证步骤

1. `pnpm test -- parser.test.ts` — 全部通过，期望值更新后无失败
2. `pnpm test` — 全量测试通过
3. **真机验证**：
   - 普通聊天消息 → 不弹"已自动记账"通知，不弹确认卡片
   - 真实微信支付通知 → 弹"已自动记账"通知 → 打开 App → 弹出确认卡片 → 点确认 → 记账成功
   - 同一笔交易 10 秒内重复通知 → 只弹一次确认卡片

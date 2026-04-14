# Plan: 修复去重逻辑误杀合法连续交易

## Summary
1 分钟内连续支付 2 笔，只有第 1 笔被记录。根因：Native 层 60s 窗口以 `pkg:sbn.id` 去重，若微信复用通知 ID（更新通知内容）则第 2 笔被拦截；JS 层 10s 窗口以 `(amount, source, timestamp)` 去重，同金额短间隔交易也会被误杀。修复两层去重策略，区分"同一通知的重复推送"和"不同交易的新通知"。

## User Story
As a coco 自动记账用户,
I want 短时间内多笔支付都能被记录,
So that 我不会因为去重误杀而漏记账。

## Problem → Solution
连续交易被去重逻辑错误拦截 → Native 层用内容哈希区分通知更新 vs 新交易；JS 层用 rawText 参与去重判断

## Metadata
- **Complexity**: Medium
- **Source PRD**: N/A（bug 修复）
- **Estimated Files**: 4

---

## UX Design

### Before
```
微信支付 ¥0.01 → 记录 ✓
(30s 后) 微信支付 ¥0.01 → 被去重丢弃 ✗
```

### After
```
微信支付 ¥0.01 → 记录 ✓
(30s 后) 微信支付 ¥0.01 → 记录 ✓
(同一通知重复推送) → 正确去重 ✓
```

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `modules/.../NotificationListenerServiceImpl.kt` | 76-88 | Native 去重逻辑 |
| P0 | `apps/mobile/lib/auto-bookkeeping/dedup.ts` | all | JS 去重逻辑 |
| P1 | `apps/mobile/hooks/useAutoBookkeeping.ts` | 52-75 | processNotification 调用去重的位置 |
| P1 | `apps/mobile/lib/auto-bookkeeping/pending-queue.ts` | 80-103 | getRecentForDedup 查询 |

---

## Patterns to Mirror

### NATIVE_DEDUP_CURRENT
```kotlin
// SOURCE: NotificationListenerServiceImpl.kt:78-88
val dedupKey = "$pkg:${sbn.id}"
synchronized(processedKeys) {
  processedKeys.entries.removeAll { now - it.value > DEDUP_WINDOW_MS }
  if (processedKeys.containsKey(dedupKey)) return
  processedKeys[dedupKey] = now
}
```

### JS_DEDUP_CURRENT
```typescript
// SOURCE: dedup.ts:9-20
export function isDuplicate(
  incoming: DedupItem,
  existingItems: readonly DedupItem[],
  windowMs: number = DEFAULT_WINDOW_MS,
): boolean {
  return existingItems.some(
    (existing) =>
      existing.source === incoming.source &&
      existing.amount === incoming.amount &&
      Math.abs(existing.timestamp - incoming.timestamp) < windowMs,
  );
}
```

### PROCESS_NOTIFICATION_DEDUP_CALL
```typescript
// SOURCE: useAutoBookkeeping.ts:59-75
const recentItems = await getRecentForDedup(currentDb, currentUserId, event.timestamp);
if (isDuplicate(
  { amount: parsed.amount, source: parsed.source, timestamp: event.timestamp },
  recentItems,
)) { return; }
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `modules/.../NotificationListenerServiceImpl.kt` | UPDATE | 去重 key 加入内容哈希 |
| `apps/mobile/lib/auto-bookkeeping/dedup.ts` | UPDATE | 去重条件加入 rawText 比较 |
| `apps/mobile/hooks/useAutoBookkeeping.ts` | UPDATE | 传递 rawText 给 isDuplicate |
| `apps/mobile/lib/auto-bookkeeping/pending-queue.ts` | UPDATE | getRecentForDedup 返回 raw_text |

## NOT Building

- 不改变 parser 逻辑
- 不改变 PendingConfirmOverlay UI 逻辑
- 不改变数据库 schema（raw_text 字段已存在）

---

## Step-by-Step Tasks

### Task 1: Native 层 —— 去重 key 加入通知内容哈希

- **ACTION**: 将 `dedupKey` 从 `"$pkg:${sbn.id}"` 改为 `"$pkg:${sbn.id}:${contentHash}"`，使得同一通知 ID 但内容变化时不会被去重
- **IMPLEMENT**:
  ```kotlin
  // 提取通知内容后再做去重（移动去重逻辑到内容提取之后）
  val extras = sbn.notification?.extras ?: return
  val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
  val text = (
    extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
      ?: extras.getCharSequence(Notification.EXTRA_TEXT)
      ?: extras.getCharSequence(Notification.EXTRA_SUB_TEXT)
  )?.toString() ?: ""

  // 用 pkg + id + 内容哈希 去重
  // 同一通知重复推送（内容不变）→ 被去重 ✓
  // 同一通知 ID 但内容更新（新交易）→ 放行 ✓
  val contentHash = (title + text).hashCode()
  val dedupKey = "$pkg:${sbn.id}:$contentHash"
  ```
- **MIRROR**: NATIVE_DEDUP_CURRENT
- **GOTCHA**: 去重逻辑需要移到内容提取之后（当前在内容提取之前），否则无法计算内容哈希。注意移动后 `text.isBlank()` 检查仍要保留
- **VALIDATE**: `npx expo run:android` 后，连续两笔不同金额支付都能被识别

### Task 2: JS 层 —— DedupItem 增加 rawText 字段

- **ACTION**: 扩展 `DedupItem` 接口，增加可选的 `rawText` 字段，在去重比较中使用
- **IMPLEMENT**:
  ```typescript
  export interface DedupItem {
    readonly amount: number;
    readonly source: string;
    readonly timestamp: number;
    readonly rawText?: string;
  }

  export function isDuplicate(
    incoming: DedupItem,
    existingItems: readonly DedupItem[],
    windowMs: number = DEFAULT_WINDOW_MS,
  ): boolean {
    return existingItems.some(
      (existing) =>
        existing.source === incoming.source &&
        existing.amount === incoming.amount &&
        existing.rawText === incoming.rawText &&
        Math.abs(existing.timestamp - incoming.timestamp) < windowMs,
    );
  }
  ```
- **MIRROR**: JS_DEDUP_CURRENT
- **GOTCHA**: `rawText` 用 `===` 比较。如果两笔不同交易的通知文本完全相同（同金额、同商户），仍会被去重。但这种情况极其罕见且无法仅从通知内容区分，可接受。对于 rawText 都是 undefined 的情况（undefined === undefined 为 true），行为与之前一致
- **VALIDATE**: 单元测试通过

### Task 3: getRecentForDedup 返回 raw_text

- **ACTION**: 修改查询，返回 `raw_text` 字段用于去重比较
- **IMPLEMENT**:
  ```typescript
  export async function getRecentForDedup(
    db: SQLite.SQLiteDatabase,
    userId: string,
    referenceTimestamp?: number,
    windowMs: number = 10_000,
  ): Promise<readonly { amount: number; source: string; timestamp: number; rawText: string | null }[]> {
    const cutoff = (referenceTimestamp ?? Date.now()) - windowMs;
    const rows = await db.getAllAsync<{
      amount: number;
      source: string;
      notification_timestamp: number;
      raw_text: string | null;
    }>(
      `SELECT amount, source, notification_timestamp, raw_text FROM pending_notifications
       WHERE user_id = ? AND notification_timestamp > ?
       ORDER BY notification_timestamp DESC`,
      userId,
      cutoff,
    );
    return rows.map((r) => ({
      amount: r.amount,
      source: r.source,
      timestamp: r.notification_timestamp,
      rawText: r.raw_text,
    }));
  }
  ```
- **MIRROR**: 当前 getRecentForDedup 实现
- **GOTCHA**: 字段名映射：DB 中是 `raw_text`（snake_case），返回对象用 `rawText`（camelCase）
- **VALIDATE**: TypeScript 编译通过

### Task 4: processNotification 传递 rawText

- **ACTION**: 在 `useAutoBookkeeping` 的 `processNotification` 中，传递 `parsed.rawText` 给 `isDuplicate`
- **IMPLEMENT**:
  ```typescript
  if (
    isDuplicate(
      {
        amount: parsed.amount,
        source: parsed.source,
        timestamp: event.timestamp,
        rawText: parsed.rawText,
      },
      recentItems,
    )
  ) { return; }
  ```
- **MIRROR**: PROCESS_NOTIFICATION_DEDUP_CALL
- **GOTCHA**: `parsed.rawText` 对应 `event.text`（通知正文），已在 parser 中保存
- **VALIDATE**: TypeScript 编译通过

### Task 5: 更新 dedup 单元测试

- **ACTION**: 补充测试用例覆盖新场景：同金额不同 rawText 不应去重
- **IMPLEMENT**:
  ```typescript
  test("同金额不同 rawText 不算重复", () => {
    const existing = [
      { amount: 0.01, source: "wechat", timestamp: 1000, rawText: "微信支付-商户A" },
    ];
    const incoming = { amount: 0.01, source: "wechat", timestamp: 1005, rawText: "微信支付-商户B" };
    expect(isDuplicate(incoming, existing)).toBe(false);
  });

  test("同金额同 rawText 在窗口内算重复", () => {
    const existing = [
      { amount: 0.01, source: "wechat", timestamp: 1000, rawText: "微信支付-商户A" },
    ];
    const incoming = { amount: 0.01, source: "wechat", timestamp: 1005, rawText: "微信支付-商户A" };
    expect(isDuplicate(incoming, existing)).toBe(true);
  });
  ```
- **VALIDATE**: 测试全部通过

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected | Edge Case? |
|---|---|---|---|
| 不同 rawText → 不去重 | 同金额、同 source、不同 text、10s 内 | false | No |
| 相同 rawText → 去重 | 同金额、同 source、同 text、10s 内 | true | No |
| rawText 都为 undefined → 去重 | 同金额、同 source、无 text、10s 内 | true | Yes |
| 超出时间窗口 → 不去重 | 同金额、同 text、>10s | false | No |

### Edge Cases Checklist
- [x] 同金额同商户连续支付（同 rawText）：仅记录 1 次（正确去重）
- [x] 同金额不同商户连续支付（不同 rawText）：记录 2 次
- [x] 不同金额连续支付：记录 2 次
- [x] 微信更新同一通知（Native 层 contentHash 相同）：只处理 1 次
- [x] 微信更新通知内容为新交易（Native 层 contentHash 不同）：处理 2 次

---

## Validation Commands

### Static Analysis
```bash
npx tsc --noEmit --project apps/mobile/tsconfig.json
```

### Unit Tests
```bash
npx jest apps/mobile/lib/auto-bookkeeping/__tests__/dedup.test.ts
```

### Manual Validation
- [ ] `npx expo run:android`（Kotlin 改动需要重编原生）
- [ ] 微信连续转账 ¥0.01 × 2（间隔 < 1 分钟）
- [ ] 两笔都应被记录
- [ ] 单笔转账不应出现重复记录

---

## Acceptance Criteria
- [ ] 1 分钟内连续 2 笔不同交易都被记录
- [ ] 单笔交易的通知重复推送仍被正确去重
- [ ] TypeScript 编译零新错误
- [ ] dedup 单元测试通过

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 微信两笔交易通知文本完全相同 | LOW | 第 2 笔仍被误杀 | rawText 包含时间/流水号时可区分；极端情况可接受 |
| Kotlin hashCode 碰撞 | VERY LOW | 不同内容产生相同 hash → 误去重 | String.hashCode 碰撞率极低，且配合 sbn.id 复合 key |
| 移动去重逻辑位置后影响性能 | LOW | 先提取内容再去重 | 内容提取本身很轻量（读 extras），影响可忽略 |

## Notes
- Task 1 改动了 Kotlin 原生代码，**必须** `npx expo run:android` 重编
- Task 2-5 是纯 TS 改动，Metro 热更新即可
- 建议先执行 Task 1 并 rebuild，确认 Native 层改动生效后再做 JS 层

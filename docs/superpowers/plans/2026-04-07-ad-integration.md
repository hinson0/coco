# 穿山甲广告接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为棉花记 App 接入穿山甲广告 SDK，实现激励视频信息流（收益 Tab）和开屏广告，用户通过观看广告累积权益解锁高级功能。

**Architecture:** 通过 Expo Module (`expo-modules-api`) 桥接穿山甲原生 SDK（iOS Swift + Android Kotlin）。权益系统纯本地 SQLite 管理，核心逻辑抽为纯函数方便测试。收益 Tab 替换原 bills.tsx，实现自动播放广告流。

**Tech Stack:** Expo SDK 55, expo-modules-api, 穿山甲 SDK (CSJ), SQLite, React Query, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-07-ad-integration-design.md`

**已知限制：** 项目目前没有 Pro 会员状态管理（`upgrade-pro.tsx` 仅是静态展示页）。Spec 要求 Pro 用户跳过所有门控和开屏广告，但这依赖 Pro 订阅系统的实现。本计划中的 Pro 检查以 `// TODO: Pro check` 标注，待 Pro 系统上线后补全。

---

## File Structure

### 新建文件

```
modules/expo-pangle/
├── src/
│   ├── ExpoPangle.ts                    # JS API 层（init, showSplashAd, loadRewardedVideo, showRewardedVideo）
│   └── ExpoPangle.types.ts              # TS 类型定义
├── ios/
│   ├── ExpoPangleModule.swift           # iOS 原生桥接（穿山甲 SDK 调用）
│   └── ExpoPangle.podspec               # CocoaPods 配置
├── android/
│   ├── build.gradle.kts                 # Gradle 配置（穿山甲 Maven 依赖）
│   └── src/main/java/expo/modules/pangle/
│       └── ExpoPangleModule.kt          # Android 原生桥接
├── expo-module.config.json              # Expo module 声明
└── plugin/
    └── withPangle.ts                    # Config plugin（自动配置 Info.plist / AndroidManifest）

apps/mobile/
├── lib/entitlements/
│   ├── rewards.ts                       # 纯函数：观看次数 → 权益分配映射
│   ├── decay.ts                         # 纯函数：时段型权益衰减计算
│   └── queries.ts                       # SQLite 读写操作封装
├── hooks/
│   ├── useEntitlement.ts                # 权益检查/扣减 hook
│   └── useEntitlementDecay.ts           # 定时衰减 hook（启动+恢复时执行）
├── components/
│   └── shared/
│       └── EntitlementGate.tsx           # 权益不足弹窗组件
└── lib/entitlements/__tests__/
    ├── rewards.test.ts                  # 权益分配测试
    └── decay.test.ts                    # 衰减计算测试
```

### 修改文件

```
apps/mobile/lib/db/schema.ts            # 新增 ad_watch_logs + entitlements 表
apps/mobile/app/(tabs)/bills.tsx         # 整体替换为广告信息流页面
apps/mobile/app/_layout.tsx              # 新增穿山甲初始化 + 开屏广告
apps/mobile/app/ad-rewards.tsx           # 更新规则说明（4个一循环，新增CSV）
apps/mobile/app.json                     # 新增 expo-pangle config plugin
apps/mobile/hooks/useChat.ts             # sendAsr/sendOcr 加权益检查
apps/mobile/components/profile/ExportSheet.tsx  # 导出前加权益检查
apps/mobile/app/accounts.tsx             # 多账户操作加权益检查
```

---

### Task 1: 权益核心逻辑（纯函数 + 测试）

**Files:**
- Create: `apps/mobile/lib/entitlements/rewards.ts`
- Create: `apps/mobile/lib/entitlements/decay.ts`
- Create: `apps/mobile/lib/entitlements/__tests__/rewards.test.ts`
- Create: `apps/mobile/lib/entitlements/__tests__/decay.test.ts`

- [ ] **Step 1: 编写权益分配测试**

```typescript
// apps/mobile/lib/entitlements/__tests__/rewards.test.ts
import { getRewardForWatch, FEATURES } from '../rewards';

describe('getRewardForWatch', () => {
  it('第 1 条广告奖励 asr +1', () => {
    expect(getRewardForWatch(1)).toEqual({ feature: 'asr', amount: 1 });
  });

  it('第 2 条广告奖励 ocr +1', () => {
    expect(getRewardForWatch(2)).toEqual({ feature: 'ocr', amount: 1 });
  });

  it('第 3 条广告奖励 multi_account +7', () => {
    expect(getRewardForWatch(3)).toEqual({ feature: 'multi_account', amount: 7 });
  });

  it('第 4 条广告奖励 csv_export +1', () => {
    expect(getRewardForWatch(4)).toEqual({ feature: 'csv_export', amount: 1 });
  });

  it('第 5 条循环回 asr', () => {
    expect(getRewardForWatch(5)).toEqual({ feature: 'asr', amount: 1 });
  });

  it('第 8 条循环回 csv_export', () => {
    expect(getRewardForWatch(8)).toEqual({ feature: 'csv_export', amount: 1 });
  });

  it('第 0 条抛出错误', () => {
    expect(() => getRewardForWatch(0)).toThrow();
  });
});

describe('FEATURES', () => {
  it('包含 4 个功能', () => {
    expect(FEATURES).toHaveLength(4);
  });

  it('每个功能有 feature 和 amount', () => {
    for (const f of FEATURES) {
      expect(f).toHaveProperty('feature');
      expect(f).toHaveProperty('amount');
      expect(f.amount).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/mobile && npx jest lib/entitlements/__tests__/rewards.test.ts --no-cache`
Expected: FAIL — `Cannot find module '../rewards'`

- [ ] **Step 3: 实现权益分配逻辑**

```typescript
// apps/mobile/lib/entitlements/rewards.ts

export type FeatureKey = 'asr' | 'ocr' | 'multi_account' | 'csv_export';

export interface Reward {
  feature: FeatureKey;
  amount: number;
}

/**
 * 4 个功能一循环。
 * amount 的含义因 feature 不同：asr/ocr 是次数，multi_account 是天数，csv_export 是周数。
 */
export const FEATURES: readonly Reward[] = [
  { feature: 'asr', amount: 1 },
  { feature: 'ocr', amount: 1 },
  { feature: 'multi_account', amount: 7 },
  { feature: 'csv_export', amount: 1 },
] as const;

/**
 * 根据累计观看条数，返回本条广告奖励的权益。
 * @param watchCount 第几条（从 1 开始）
 */
export function getRewardForWatch(watchCount: number): Reward {
  if (watchCount < 1) throw new Error('watchCount must be >= 1');
  const index = (watchCount - 1) % FEATURES.length;
  return FEATURES[index];
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/mobile && npx jest lib/entitlements/__tests__/rewards.test.ts --no-cache`
Expected: PASS — 7 tests passed

- [ ] **Step 5: 编写衰减计算测试**

```typescript
// apps/mobile/lib/entitlements/__tests__/decay.test.ts
import { calculateDailyDecay, calculateWeeklyDecay } from '../decay';

describe('calculateDailyDecay', () => {
  it('同一天内不衰减', () => {
    const lastDecay = '2026-04-07T00:00:00.000Z';
    const now = '2026-04-07T23:59:59.000Z';
    expect(calculateDailyDecay(10, lastDecay, now)).toBe(0);
  });

  it('过了 1 天衰减 1', () => {
    const lastDecay = '2026-04-07T00:00:00.000Z';
    const now = '2026-04-08T01:00:00.000Z';
    expect(calculateDailyDecay(10, lastDecay, now)).toBe(1);
  });

  it('过了 3 天衰减 3', () => {
    const lastDecay = '2026-04-07T00:00:00.000Z';
    const now = '2026-04-10T12:00:00.000Z';
    expect(calculateDailyDecay(10, lastDecay, now)).toBe(3);
  });

  it('衰减不超过余额', () => {
    const lastDecay = '2026-04-07T00:00:00.000Z';
    const now = '2026-04-20T00:00:00.000Z'; // 13 天
    expect(calculateDailyDecay(5, lastDecay, now)).toBe(5);
  });

  it('余额为 0 不衰减', () => {
    const lastDecay = '2026-04-07T00:00:00.000Z';
    const now = '2026-04-10T00:00:00.000Z';
    expect(calculateDailyDecay(0, lastDecay, now)).toBe(0);
  });

  it('lastDecay 为 null 不衰减（首次）', () => {
    expect(calculateDailyDecay(10, null, '2026-04-10T00:00:00.000Z')).toBe(0);
  });
});

describe('calculateWeeklyDecay', () => {
  it('同一周内不衰减', () => {
    // 2026-04-06 是周一
    const lastDecay = '2026-04-06T00:00:00.000Z';
    const now = '2026-04-12T23:59:59.000Z'; // 同周日
    expect(calculateWeeklyDecay(5, lastDecay, now)).toBe(0);
  });

  it('过了 1 个周一衰减 1', () => {
    const lastDecay = '2026-04-06T00:00:00.000Z'; // 周一
    const now = '2026-04-13T01:00:00.000Z'; // 下周一
    expect(calculateWeeklyDecay(5, lastDecay, now)).toBe(1);
  });

  it('过了 3 个周一衰减 3', () => {
    const lastDecay = '2026-04-06T00:00:00.000Z';
    const now = '2026-04-27T00:00:00.000Z'; // 3 周后的周一
    expect(calculateWeeklyDecay(5, lastDecay, now)).toBe(3);
  });

  it('衰减不超过余额', () => {
    const lastDecay = '2026-04-06T00:00:00.000Z';
    const now = '2026-06-01T00:00:00.000Z'; // 很久之后
    expect(calculateWeeklyDecay(2, lastDecay, now)).toBe(2);
  });
});
```

- [ ] **Step 6: 运行测试确认失败**

Run: `cd apps/mobile && npx jest lib/entitlements/__tests__/decay.test.ts --no-cache`
Expected: FAIL — `Cannot find module '../decay'`

- [ ] **Step 7: 实现衰减计算逻辑**

```typescript
// apps/mobile/lib/entitlements/decay.ts

/**
 * 计算自 lastDecay 以来经过了多少个自然日（跨 0 点的次数）。
 * 衰减量 = min(经过天数, 当前余额)。
 */
export function calculateDailyDecay(
  balance: number,
  lastDecay: string | null,
  now: string,
): number {
  if (balance <= 0 || !lastDecay) return 0;

  const lastDate = new Date(lastDecay);
  const nowDate = new Date(now);

  // 取各自的 UTC 日期起始（0 点），计算天差
  const lastDay = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
  const nowDay = Date.UTC(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  const daysPassed = Math.floor((nowDay - lastDay) / (24 * 60 * 60 * 1000));

  if (daysPassed <= 0) return 0;
  return Math.min(daysPassed, balance);
}

/**
 * 计算自 lastDecay 以来经过了多少个周一（ISO 周起点）。
 * 衰减量 = min(经过周数, 当前余额)。
 */
export function calculateWeeklyDecay(
  balance: number,
  lastDecay: string | null,
  now: string,
): number {
  if (balance <= 0 || !lastDecay) return 0;

  const lastDate = new Date(lastDecay);
  const nowDate = new Date(now);

  const lastMonday = getMondayUTC(lastDate);
  const nowMonday = getMondayUTC(nowDate);

  const weeksPassed = Math.floor((nowMonday - lastMonday) / (7 * 24 * 60 * 60 * 1000));

  if (weeksPassed <= 0) return 0;
  return Math.min(weeksPassed, balance);
}

/** 获取给定日期所在周的周一 0:00 UTC 时间戳 */
function getMondayUTC(date: Date): number {
  const d = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = new Date(d).getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return d - daysFromMonday * 24 * 60 * 60 * 1000;
}
```

- [ ] **Step 8: 运行测试确认通过**

Run: `cd apps/mobile && npx jest lib/entitlements/__tests__/ --no-cache`
Expected: PASS — 全部 13 tests passed

- [ ] **Step 9: 提交**

```bash
cd apps/mobile && git add lib/entitlements/
git commit -m "feat(entitlements): 权益核心逻辑 — 分配映射和衰减计算

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 数据库 Schema + 权益 SQL 操作

**Files:**
- Modify: `apps/mobile/lib/db/schema.ts:83-91` (createTables 函数)
- Create: `apps/mobile/lib/entitlements/queries.ts`

- [ ] **Step 1: 在 schema.ts 中新增两张表定义**

在 `apps/mobile/lib/db/schema.ts` 中，在 `CREATE_ACCOUNTS` 之后添加：

```typescript
const CREATE_AD_WATCH_LOGS = `
  CREATE TABLE IF NOT EXISTS ad_watch_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watched_at TEXT NOT NULL,
    ad_type TEXT NOT NULL CHECK(ad_type IN ('rewarded_video', 'splash')),
    slot_id TEXT,
    duration_sec INTEGER
  );
`;

const CREATE_ENTITLEMENTS = `
  CREATE TABLE IF NOT EXISTS entitlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feature TEXT NOT NULL UNIQUE CHECK(feature IN ('asr', 'ocr', 'multi_account', 'csv_export')),
    balance INTEGER NOT NULL DEFAULT 0,
    total_earned INTEGER NOT NULL DEFAULT 0,
    last_decay_at TEXT
  );
`;
```

在 `createTables` 函数中，在 `await db.execAsync(CREATE_ACCOUNTS)` 之后添加：

```typescript
await db.execAsync(CREATE_AD_WATCH_LOGS);
await db.execAsync(CREATE_ENTITLEMENTS);
```

注意 `entitlements` 表新增了 `last_decay_at` 字段，用于记录上次衰减时间，spec 中未提但实现需要。

- [ ] **Step 2: 创建权益 SQL 操作封装**

```typescript
// apps/mobile/lib/entitlements/queries.ts
import type * as SQLite from 'expo-sqlite';
import type { FeatureKey } from './rewards';

export interface EntitlementRow {
  feature: FeatureKey;
  balance: number;
  total_earned: number;
  last_decay_at: string | null;
}

/** 查询单个功能的权益余额，不存在则返回 balance=0 */
export async function getEntitlement(
  db: SQLite.SQLiteDatabase,
  feature: FeatureKey,
): Promise<EntitlementRow> {
  const row = await db.getFirstAsync<EntitlementRow>(
    'SELECT feature, balance, total_earned, last_decay_at FROM entitlements WHERE feature = ?',
    feature,
  );
  return row ?? { feature, balance: 0, total_earned: 0, last_decay_at: null };
}

/** 查询所有功能的权益余额 */
export async function getAllEntitlements(
  db: SQLite.SQLiteDatabase,
): Promise<EntitlementRow[]> {
  const rows = await db.getAllAsync<EntitlementRow>(
    'SELECT feature, balance, total_earned, last_decay_at FROM entitlements ORDER BY feature',
  );
  return rows;
}

/** 增加权益余额（upsert） */
export async function addEntitlement(
  db: SQLite.SQLiteDatabase,
  feature: FeatureKey,
  amount: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO entitlements (feature, balance, total_earned)
     VALUES (?, ?, ?)
     ON CONFLICT(feature) DO UPDATE SET
       balance = balance + excluded.balance,
       total_earned = total_earned + excluded.total_earned`,
    feature,
    amount,
    amount,
  );
}

/** 扣减权益余额，返回扣减后余额。余额不足返回 -1。 */
export async function consumeEntitlement(
  db: SQLite.SQLiteDatabase,
  feature: FeatureKey,
): Promise<number> {
  const row = await getEntitlement(db, feature);
  if (row.balance <= 0) return -1;
  const newBalance = row.balance - 1;
  await db.runAsync(
    'UPDATE entitlements SET balance = ? WHERE feature = ?',
    newBalance,
    feature,
  );
  return newBalance;
}

/** 批量衰减（用于 multi_account / csv_export），更新 last_decay_at */
export async function applyDecay(
  db: SQLite.SQLiteDatabase,
  feature: FeatureKey,
  decayAmount: number,
  now: string,
): Promise<void> {
  if (decayAmount <= 0) return;
  await db.runAsync(
    'UPDATE entitlements SET balance = MAX(balance - ?, 0), last_decay_at = ? WHERE feature = ?',
    decayAmount,
    now,
    feature,
  );
}

/** 记录广告观看日志 */
export async function logAdWatch(
  db: SQLite.SQLiteDatabase,
  adType: 'rewarded_video' | 'splash',
  slotId: string | null,
  durationSec: number | null,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO ad_watch_logs (watched_at, ad_type, slot_id, duration_sec) VALUES (?, ?, ?, ?)',
    new Date().toISOString(),
    adType,
    slotId,
    durationSec,
  );
}

/** 查询累计观看次数（仅激励视频，用于计算下一个奖励） */
export async function getTotalRewardedWatchCount(
  db: SQLite.SQLiteDatabase,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM ad_watch_logs WHERE ad_type = 'rewarded_video'",
  );
  return row?.count ?? 0;
}
```

- [ ] **Step 3: 运行现有测试确认没有回归**

Run: `cd apps/mobile && npx jest --no-cache`
Expected: 全部现有测试 PASS（schema 变更不影响纯函数测试）

- [ ] **Step 4: 提交**

```bash
git add apps/mobile/lib/db/schema.ts apps/mobile/lib/entitlements/queries.ts
git commit -m "feat(entitlements): 新增 ad_watch_logs/entitlements 表及 SQL 操作

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 权益 Hooks（useEntitlement + useEntitlementDecay）

**Files:**
- Create: `apps/mobile/hooks/useEntitlement.ts`
- Create: `apps/mobile/hooks/useEntitlementDecay.ts`

- [ ] **Step 1: 创建 useEntitlement hook**

```typescript
// apps/mobile/hooks/useEntitlement.ts
import { useOfflineContext } from '@/lib/offline-context';
import type { FeatureKey } from '@/lib/entitlements/rewards';
import {
  getEntitlement,
  getAllEntitlements,
  consumeEntitlement,
  addEntitlement,
  logAdWatch,
  getTotalRewardedWatchCount,
} from '@/lib/entitlements/queries';
import { getRewardForWatch } from '@/lib/entitlements/rewards';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

const ENTITLEMENT_KEY = ['entitlements'];
const AD_WATCH_COUNT_KEY = ['ad-watch-count'];

/** 查询所有权益余额 */
export function useEntitlements() {
  const { db } = useOfflineContext();
  return useQuery({
    queryKey: ENTITLEMENT_KEY,
    queryFn: () => getAllEntitlements(db!),
    enabled: !!db,
  });
}

/** 查询单个功能权益余额 */
export function useFeatureEntitlement(feature: FeatureKey) {
  const { db } = useOfflineContext();
  return useQuery({
    queryKey: [...ENTITLEMENT_KEY, feature],
    queryFn: () => getEntitlement(db!, feature),
    enabled: !!db,
  });
}

/** 查询累计激励视频观看次数 */
export function useAdWatchCount() {
  const { db } = useOfflineContext();
  return useQuery({
    queryKey: AD_WATCH_COUNT_KEY,
    queryFn: () => getTotalRewardedWatchCount(db!),
    enabled: !!db,
  });
}

/** 使用（扣减）一次权益，返回 { success, newBalance } */
export function useConsumeEntitlement() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (feature: FeatureKey) => {
      if (!db) throw new Error('Database not ready');
      const newBalance = await consumeEntitlement(db, feature);
      return { success: newBalance >= 0, newBalance };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENTITLEMENT_KEY });
    },
  });
}

/**
 * 记录一次激励视频观看并分配权益。
 * 返回本次获得的权益信息。
 */
export function useRecordAdWatch() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { slotId: string | null; durationSec: number | null }) => {
      if (!db) throw new Error('Database not ready');

      // 1. 记录观看日志
      await logAdWatch(db, 'rewarded_video', params.slotId, params.durationSec);

      // 2. 查询当前累计观看次数（包含刚插入的这条）
      const totalCount = await getTotalRewardedWatchCount(db);

      // 3. 根据累计次数计算奖励
      const reward = getRewardForWatch(totalCount);

      // 4. 增加权益余额
      await addEntitlement(db, reward.feature, reward.amount);

      return { totalCount, reward };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENTITLEMENT_KEY });
      qc.invalidateQueries({ queryKey: AD_WATCH_COUNT_KEY });
    },
  });
}
```

- [ ] **Step 2: 创建 useEntitlementDecay hook**

```typescript
// apps/mobile/hooks/useEntitlementDecay.ts
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineContext } from '@/lib/offline-context';
import { getEntitlement, applyDecay } from '@/lib/entitlements/queries';
import { calculateDailyDecay, calculateWeeklyDecay } from '@/lib/entitlements/decay';

/**
 * 在 App 启动和从后台恢复时，检查并执行时段型权益的衰减。
 * - multi_account: 每天 -1
 * - csv_export: 每周一 -1
 *
 * 放在根布局中使用。
 */
export function useEntitlementDecay() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();
  const hasRunRef = useRef(false);

  const runDecay = async () => {
    if (!db) return;
    const now = new Date().toISOString();

    // 多账户管理：按天衰减
    const multiAccount = await getEntitlement(db, 'multi_account');
    const dailyDecay = calculateDailyDecay(multiAccount.balance, multiAccount.last_decay_at, now);
    if (dailyDecay > 0) {
      await applyDecay(db, 'multi_account', dailyDecay, now);
    }

    // CSV 导出：按周衰减
    const csvExport = await getEntitlement(db, 'csv_export');
    const weeklyDecay = calculateWeeklyDecay(csvExport.balance, csvExport.last_decay_at, now);
    if (weeklyDecay > 0) {
      await applyDecay(db, 'csv_export', weeklyDecay, now);
    }

    if (dailyDecay > 0 || weeklyDecay > 0) {
      qc.invalidateQueries({ queryKey: ['entitlements'] });
    }
  };

  // App 启动时执行一次
  useEffect(() => {
    if (db && !hasRunRef.current) {
      hasRunRef.current = true;
      runDecay();
    }
  }, [db]);

  // 从后台恢复时执行
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        runDecay();
      }
    });
    return () => subscription.remove();
  }, [db]);
}
```

- [ ] **Step 3: 运行现有测试确认没有回归**

Run: `cd apps/mobile && npx jest --no-cache`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add apps/mobile/hooks/useEntitlement.ts apps/mobile/hooks/useEntitlementDecay.ts
git commit -m "feat(entitlements): useEntitlement + useEntitlementDecay hooks

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Expo Pangle 原生模块 — JS 层 + Config Plugin

**Files:**
- Create: `modules/expo-pangle/src/ExpoPangle.types.ts`
- Create: `modules/expo-pangle/src/ExpoPangle.ts`
- Create: `modules/expo-pangle/expo-module.config.json`
- Create: `modules/expo-pangle/plugin/withPangle.ts`
- Modify: `apps/mobile/app.json`

**注意：** 执行此 Task 前，需先查阅穿山甲最新 SDK 文档确认 SDK 包名和版本号。可使用 Context7 MCP tool 查询 `expo-modules-api` 文档确认 Expo Module 最新 API。

- [ ] **Step 1: 创建类型定义**

```typescript
// modules/expo-pangle/src/ExpoPangle.types.ts

export interface PangleInitConfig {
  appId: string;
}

export interface SplashAdResult {
  success: boolean;
}

export interface RewardedVideoResult {
  success: boolean;
  rewardVerify: boolean;
}

export interface AdErrorEvent {
  code: number;
  message: string;
}
```

- [ ] **Step 2: 创建 JS API 层**

```typescript
// modules/expo-pangle/src/ExpoPangle.ts
import { requireNativeModule, EventEmitter } from 'expo-modules-core';
import type {
  PangleInitConfig,
  SplashAdResult,
  RewardedVideoResult,
  AdErrorEvent,
} from './ExpoPangle.types';

const NativeModule = requireNativeModule('ExpoPangle');
const emitter = new EventEmitter(NativeModule);

export async function init(config: PangleInitConfig): Promise<void> {
  return NativeModule.init(config.appId);
}

export async function showSplashAd(slotId: string): Promise<SplashAdResult> {
  return NativeModule.showSplashAd(slotId);
}

export async function loadRewardedVideo(slotId: string): Promise<void> {
  return NativeModule.loadRewardedVideo(slotId);
}

export async function showRewardedVideo(): Promise<RewardedVideoResult> {
  return NativeModule.showRewardedVideo();
}

export function onAdLoaded(callback: () => void) {
  return emitter.addListener('onAdLoaded', callback);
}

export function onAdClosed(callback: () => void) {
  return emitter.addListener('onAdClosed', callback);
}

export function onAdError(callback: (event: AdErrorEvent) => void) {
  return emitter.addListener('onAdError', callback);
}
```

- [ ] **Step 3: 创建 Expo Module 配置**

```json
// modules/expo-pangle/expo-module.config.json
{
  "platforms": ["ios", "android"],
  "ios": {
    "modules": ["ExpoPangleModule"]
  },
  "android": {
    "modules": ["expo.modules.pangle.ExpoPangleModule"]
  }
}
```

- [ ] **Step 4: 创建 Config Plugin**

```typescript
// modules/expo-pangle/plugin/withPangle.ts
import {
  withInfoPlist,
  withAndroidManifest,
  type ConfigPlugin,
} from 'expo/config-plugins';

const withPangle: ConfigPlugin<{ appId?: string } | void> = (config, props) => {
  // iOS: 添加 ATT 权限描述 + SKAdNetwork
  config = withInfoPlist(config, (mod) => {
    mod.modResults.NSUserTrackingUsageDescription =
      '为了给您展示更相关的广告内容，我们需要获取您的广告标识符';

    // 穿山甲 SKAdNetwork ID（需根据穿山甲文档更新）
    const skAdNetworkItems = mod.modResults.SKAdNetworkItems ?? [];
    const pangleSkAdId = { SKAdNetworkIdentifier: '238da6jt44.skadnetwork' };
    if (!skAdNetworkItems.some((item: any) => item.SKAdNetworkIdentifier === pangleSkAdId.SKAdNetworkIdentifier)) {
      skAdNetworkItems.push(pangleSkAdId);
    }
    mod.modResults.SKAdNetworkItems = skAdNetworkItems;

    return mod;
  });

  // Android: 添加网络权限
  config = withAndroidManifest(config, (mod) => {
    const mainApp = mod.modResults.manifest.application?.[0];
    if (mainApp) {
      // 穿山甲需要的 provider（具体 authorities 需替换为实际 package name）
      const providers = mainApp.provider ?? [];
      mainApp.provider = providers;
    }

    // 确保有网络权限
    const permissions = mod.modResults.manifest['uses-permission'] ?? [];
    const needed = [
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
    ];
    for (const perm of needed) {
      if (!permissions.some((p: any) => p.$?.['android:name'] === perm)) {
        permissions.push({ $: { 'android:name': perm } });
      }
    }
    mod.modResults.manifest['uses-permission'] = permissions;

    return mod;
  });

  return config;
};

export default withPangle;
```

- [ ] **Step 5: 在 app.json 中注册 plugin**

在 `apps/mobile/app.json` 的 `plugins` 数组末尾添加：

```json
"../../modules/expo-pangle/plugin/withPangle"
```

完整 plugins 数组变为：
```json
"plugins": [
  "expo-router",
  ["expo-image-picker", { "cameraPermission": "允许 Coco 使用相机拍摄小票进行记账" }],
  ["expo-audio", { "microphonePermission": "允许 Coco 使用麦克风进行语音记账" }],
  "expo-sqlite",
  "@react-native-community/datetimepicker",
  "../../modules/expo-pangle/plugin/withPangle"
]
```

- [ ] **Step 6: 提交**

```bash
git add modules/expo-pangle/src/ modules/expo-pangle/expo-module.config.json modules/expo-pangle/plugin/ apps/mobile/app.json
git commit -m "feat(pangle): Expo Pangle 模块 JS 层 + Config Plugin

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Expo Pangle 原生模块 — iOS (Swift)

**Files:**
- Create: `modules/expo-pangle/ios/ExpoPangleModule.swift`
- Create: `modules/expo-pangle/ios/ExpoPangle.podspec`

**前置条件：** 需查阅穿山甲 iOS SDK 最新文档确认：
1. CocoaPods pod 名称（当前推测为 `Ads-CN`）
2. SDK 初始化 API（`BUAdSDKManager`）
3. 激励视频 API（`BUNativeExpressRewardedVideoAd`）
4. 开屏广告 API（`BUSplashAdView`）

使用 Context7 或穿山甲官方文档 (https://www.csjplatform.com/union/media/union/download) 验证。

- [ ] **Step 1: 创建 podspec**

```ruby
# modules/expo-pangle/ios/ExpoPangle.podspec
Pod::Spec.new do |s|
  s.name           = 'ExpoPangle'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for Pangle (CSJ) ads SDK'
  s.homepage       = 'https://github.com/user/expo-pangle'
  s.license        = 'MIT'
  s.author         = 'CoCo'
  s.source         = { git: '' }
  s.platform       = :ios, '15.1'
  s.swift_version  = '5.4'
  s.source_files   = '**/*.swift'

  s.dependency 'ExpoModulesCore'
  # 穿山甲中国版 SDK — 版本号需核实
  s.dependency 'Ads-CN', '~> 6.0'
end
```

- [ ] **Step 2: 创建 iOS 原生模块**

```swift
// modules/expo-pangle/ios/ExpoPangleModule.swift
import ExpoModulesCore
import BUAdSDK

public class ExpoPangleModule: Module {
  private var rewardedAd: BUNativeExpressRewardedVideoAd?
  private var rewardedPromise: Promise?
  private var splashPromise: Promise?

  public func definition() -> ModuleDefinition {
    Name("ExpoPangle")

    Events("onAdLoaded", "onAdClosed", "onAdError")

    AsyncFunction("init") { (appId: String, promise: Promise) in
      BUAdSDKManager.start(asyncInit: { config in
        config.appID = appId
      }, completionHandler: { success, error in
        if success {
          promise.resolve(nil)
        } else {
          promise.reject("INIT_FAILED", error?.localizedDescription ?? "Unknown error")
        }
      })
    }

    AsyncFunction("showSplashAd") { (slotId: String, promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self = self else { return }
        self.splashPromise = promise

        guard let rootVC = UIApplication.shared.connectedScenes
          .compactMap({ $0 as? UIWindowScene })
          .first?.windows.first?.rootViewController else {
          promise.resolve(["success": false])
          return
        }

        let splashAd = BUSplashAd(slotID: slotId, adSize: rootVC.view.bounds.size)
        splashAd.delegate = self
        splashAd.loadData()
      }
    }

    AsyncFunction("loadRewardedVideo") { (slotId: String, promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self = self else { return }
        let ad = BUNativeExpressRewardedVideoAd(slotID: slotId)
        ad.delegate = self
        self.rewardedAd = ad
        ad.loadData()
        promise.resolve(nil)
      }
    }

    AsyncFunction("showRewardedVideo") { (promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self = self, let ad = self.rewardedAd else {
          promise.resolve(["success": false, "rewardVerify": false])
          return
        }
        self.rewardedPromise = promise

        guard let rootVC = UIApplication.shared.connectedScenes
          .compactMap({ $0 as? UIWindowScene })
          .first?.windows.first?.rootViewController else {
          promise.resolve(["success": false, "rewardVerify": false])
          return
        }

        ad.show(fromRootViewController: rootVC)
      }
    }
  }
}

// MARK: - BUNativeExpressRewardedVideoAdDelegate
extension ExpoPangleModule: BUNativeExpressRewardedVideoAdDelegate {
  public func nativeExpressRewardedVideoAdDidLoad(_ rewardedVideoAd: BUNativeExpressRewardedVideoAd) {
    sendEvent("onAdLoaded", [:])
  }

  public func nativeExpressRewardedVideoAdDidClose(_ rewardedVideoAd: BUNativeExpressRewardedVideoAd) {
    sendEvent("onAdClosed", [:])
  }

  public func nativeExpressRewardedVideoAdServerRewardDidSucceed(_ rewardedVideoAd: BUNativeExpressRewardedVideoAd, verify: Bool) {
    rewardedPromise?.resolve(["success": true, "rewardVerify": verify])
    rewardedPromise = nil
  }

  public func nativeExpressRewardedVideoAd(_ rewardedVideoAd: BUNativeExpressRewardedVideoAd, didFailWithError error: Error?) {
    let msg = error?.localizedDescription ?? "Unknown error"
    sendEvent("onAdError", ["code": -1, "message": msg])
    rewardedPromise?.resolve(["success": false, "rewardVerify": false])
    rewardedPromise = nil
  }
}

// MARK: - BUSplashAdDelegate
extension ExpoPangleModule: BUSplashAdDelegate {
  public func splashAdLoadSuccess(_ splashAd: BUSplashAd) {
    guard let rootVC = UIApplication.shared.connectedScenes
      .compactMap({ $0 as? UIWindowScene })
      .first?.windows.first?.rootViewController else {
      splashPromise?.resolve(["success": false])
      splashPromise = nil
      return
    }
    splashAd.show(in: rootVC.view)
  }

  public func splashAdDidClose(_ splashAd: BUSplashAd) {
    splashPromise?.resolve(["success": true])
    splashPromise = nil
  }

  public func splashAd(_ splashAd: BUSplashAd, didFailWithError error: Error?) {
    splashPromise?.resolve(["success": false])
    splashPromise = nil
  }
}
```

> **重要提示：** 上述代码基于穿山甲 SDK v6.x 的推测 API。实际开发时必须对照最新 SDK 文档调整类名和方法签名。穿山甲 SDK 迭代频繁，delegate 协议名和方法可能不同。

- [ ] **Step 3: 提交**

```bash
git add modules/expo-pangle/ios/
git commit -m "feat(pangle): iOS 原生模块（Swift 桥接穿山甲 SDK）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Expo Pangle 原生模块 — Android (Kotlin)

**Files:**
- Create: `modules/expo-pangle/android/build.gradle.kts`
- Create: `modules/expo-pangle/android/src/main/AndroidManifest.xml`
- Create: `modules/expo-pangle/android/src/main/java/expo/modules/pangle/ExpoPangleModule.kt`

**前置条件：** 需查阅穿山甲 Android SDK 最新文档确认：
1. Maven 仓库地址
2. Gradle 依赖坐标（推测为 `com.pangle.cn:ads-sdk-pro`）
3. SDK 初始化 API（`TTAdSdk`）
4. 激励视频 API
5. 开屏广告 API

- [ ] **Step 1: 创建 build.gradle.kts**

```kotlin
// modules/expo-pangle/android/build.gradle.kts
plugins {
  id("com.android.library")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "expo.modules.pangle"
  compileSdk = 34
  defaultConfig {
    minSdk = 24
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions {
    jvmTarget = "17"
  }
}

repositories {
  // 穿山甲 Maven 仓库 — 地址需核实
  maven { url = uri("https://artifact.bytedance.com/repository/pangle") }
}

dependencies {
  implementation("expo:expo-modules-core:+")
  // 穿山甲中国版 SDK — 版本号需核实
  implementation("com.pangle.cn:ads-sdk-pro:6.+")
}
```

- [ ] **Step 2: 创建 AndroidManifest.xml**

```xml
<!-- modules/expo-pangle/android/src/main/AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
</manifest>
```

- [ ] **Step 3: 创建 Android 原生模块**

```kotlin
// modules/expo-pangle/android/src/main/java/expo/modules/pangle/ExpoPangleModule.kt
package expo.modules.pangle

import android.app.Activity
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.bytedance.sdk.openadsdk.*

class ExpoPangleModule : Module() {
  private var rewardedAd: TTRewardVideoAd? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoPangle")

    Events("onAdLoaded", "onAdClosed", "onAdError")

    AsyncFunction("init") { appId: String, promise: Promise ->
      val config = TTAdConfig.Builder()
        .appId(appId)
        .appName(appActivity?.applicationInfo?.loadLabel(appActivity!!.packageManager)?.toString() ?: "CoCo")
        .build()

      TTAdSdk.init(appContext.reactContext!!, config, object : TTAdSdk.InitCallback {
        override fun success() { promise.resolve(null) }
        override fun fail(code: Int, msg: String?) {
          promise.reject("INIT_FAILED", msg ?: "Init failed with code $code", null)
        }
      })
    }

    AsyncFunction("showSplashAd") { slotId: String, promise: Promise ->
      val activity = appActivity ?: run {
        promise.resolve(mapOf("success" to false))
        return@AsyncFunction
      }

      val adNative = TTAdSdk.getAdManager().createAdNative(activity)
      val adSlot = AdSlot.Builder()
        .setCodeId(slotId)
        .build()

      adNative.loadSplashAd(adSlot, object : TTAdNative.CSJSplashAdListener {
        override fun onSplashLoadSuccess(ad: CSJSplashAd?) {
          activity.runOnUiThread {
            ad?.showSplashView(activity.window.decorView as android.view.ViewGroup)
            ad?.setSplashAdListener(object : CSJSplashAd.SplashAdListener {
              override fun onSplashAdClose(type: Int) {
                promise.resolve(mapOf("success" to true))
              }
              override fun onSplashAdShow(ad: CSJSplashAd?) {}
            })
          }
        }
        override fun onSplashLoadFail(error: CSJAdError?) {
          promise.resolve(mapOf("success" to false))
        }
        override fun onSplashRenderSuccess(ad: CSJSplashAd?) {}
        override fun onSplashRenderFail(ad: CSJSplashAd?, error: CSJAdError?) {
          promise.resolve(mapOf("success" to false))
        }
      }, 3000) // 3 秒超时
    }

    AsyncFunction("loadRewardedVideo") { slotId: String, promise: Promise ->
      val activity = appActivity ?: run {
        promise.reject("NO_ACTIVITY", "Activity not available", null)
        return@AsyncFunction
      }

      val adNative = TTAdSdk.getAdManager().createAdNative(activity)
      val adSlot = AdSlot.Builder()
        .setCodeId(slotId)
        .setRewardVerify(true)
        .build()

      adNative.loadRewardVideoAd(adSlot, object : TTAdNative.RewardVideoAdListener {
        override fun onRewardVideoAdLoad(ad: TTRewardVideoAd?) {
          rewardedAd = ad
          sendEvent("onAdLoaded", emptyMap<String, Any>())
          promise.resolve(null)
        }
        override fun onError(code: Int, message: String?) {
          sendEvent("onAdError", mapOf("code" to code, "message" to (message ?: "")))
          promise.reject("LOAD_FAILED", message ?: "Load failed", null)
        }
        override fun onRewardVideoCached(ad: TTRewardVideoAd?) {}
      })
    }

    AsyncFunction("showRewardedVideo") { promise: Promise ->
      val activity = appActivity
      val ad = rewardedAd
      if (activity == null || ad == null) {
        promise.resolve(mapOf("success" to false, "rewardVerify" to false))
        return@AsyncFunction
      }

      ad.setRewardAdInteractionListener(object : TTRewardVideoAd.RewardAdInteractionListener {
        override fun onAdShow() {}
        override fun onAdVideoBarClick() {}
        override fun onAdClose() {
          sendEvent("onAdClosed", emptyMap<String, Any>())
        }
        override fun onVideoComplete() {}
        override fun onVideoError() {
          promise.resolve(mapOf("success" to false, "rewardVerify" to false))
        }
        override fun onRewardVerify(
          rewardVerify: Boolean, rewardAmount: Int,
          rewardName: String?, errorCode: Int, errorMsg: String?
        ) {
          promise.resolve(mapOf("success" to true, "rewardVerify" to rewardVerify))
        }
        override fun onSkippedVideo() {
          promise.resolve(mapOf("success" to false, "rewardVerify" to false))
        }
      })

      activity.runOnUiThread { ad.showRewardVideoAd(activity) }
    }
  }

  private val appActivity: Activity?
    get() = appContext.currentActivity
}
```

> **重要提示：** 同 iOS，上述代码基于穿山甲 SDK 推测 API。Android SDK 的类名（`TTAdSdk`、`TTRewardVideoAd`、`CSJSplashAd`）在不同版本可能不同。实际开发时必须对照最新 SDK 文档调整。

- [ ] **Step 4: 提交**

```bash
git add modules/expo-pangle/android/
git commit -m "feat(pangle): Android 原生模块（Kotlin 桥接穿山甲 SDK）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: 穿山甲初始化 + 开屏广告

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: 在根布局中添加穿山甲初始化和开屏广告**

修改 `apps/mobile/app/_layout.tsx`，添加以下内容：

1. 导入 ExpoPangle 和 useEntitlementDecay
2. 在 `RootLayout` 组件中初始化穿山甲 SDK
3. 添加开屏广告逻辑（冷启动 + 后台恢复，30 秒频控）
4. 调用 useEntitlementDecay

```typescript
// 在文件顶部新增导入
import * as ExpoPangle from '../../modules/expo-pangle/src/ExpoPangle';
import { useEntitlementDecay } from '../hooks/useEntitlementDecay';
import { AppState } from 'react-native';
import { useRef } from 'react';

// 穿山甲配置 — 替换为实际的 App ID 和广告位 ID
const PANGLE_APP_ID = 'YOUR_APP_ID';       // 在穿山甲后台创建应用后获取
const SPLASH_SLOT_ID = 'YOUR_SPLASH_SLOT';  // 在穿山甲后台创建开屏广告位后获取
const SPLASH_MIN_INTERVAL_MS = 30_000;       // 两次开屏广告最小间隔 30 秒
```

在 `RootLayout` 组件内添加：

```typescript
// === 穿山甲初始化 + 开屏广告 ===
const lastSplashTime = useRef(0);
const pangleReady = useRef(false);

// 权益衰减（放在根布局）
useEntitlementDecay();

// 初始化穿山甲 SDK + 首次开屏
useEffect(() => {
  async function initPangle() {
    try {
      await ExpoPangle.init({ appId: PANGLE_APP_ID });
      pangleReady.current = true;
      // 冷启动开屏广告
      await tryShowSplash();
    } catch (err) {
      console.error('[Pangle] init failed:', err);
    }
  }
  initPangle();
}, []);

// 后台恢复时开屏广告
useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active' && pangleReady.current) {
      tryShowSplash();
    }
  });
  return () => subscription.remove();
}, []);

async function tryShowSplash() {
  // TODO: Pro 用户检查 — 后续 Task 10 中从 Pro 状态判断
  const now = Date.now();
  if (now - lastSplashTime.current < SPLASH_MIN_INTERVAL_MS) return;
  lastSplashTime.current = now;
  try {
    await ExpoPangle.showSplashAd(SPLASH_SLOT_ID);
  } catch {
    // 开屏失败静默忽略，不影响用户进入 App
  }
}
```

- [ ] **Step 2: 验证 App 能正常启动**

Run: `cd apps/mobile && npx expo start` (手动验证，native 模块需 EAS Build 后才能实际运行)

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "feat(pangle): 根布局中初始化穿山甲 SDK + 开屏广告

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: 广告信息流页面（收益 Tab）

**Files:**
- Modify: `apps/mobile/app/(tabs)/bills.tsx` (整体替换)

- [ ] **Step 1: 替换 bills.tsx 为广告信息流页面**

整体替换 `apps/mobile/app/(tabs)/bills.tsx`：

```typescript
// apps/mobile/app/(tabs)/bills.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ExpoPangle from '../../../modules/expo-pangle/src/ExpoPangle';
import { useAdWatchCount, useEntitlements, useRecordAdWatch } from '../../hooks/useEntitlement';
import { getRewardForWatch, FEATURES } from '../../lib/entitlements/rewards';
import { AppText } from '../../components/ui/AppText';
import { Card } from '../../components/ui/Card';
import { colors, radii, shadows } from '../../constants/theme';

// 穿山甲广告位 ID — 替换为实际值
const REWARDED_SLOT_ID = 'YOUR_REWARDED_SLOT';

const FEATURE_LABELS: Record<string, string> = {
  asr: '语音记账',
  ocr: '小票识别',
  multi_account: '多账户管理',
  csv_export: '导出 CSV',
};

const FEATURE_ICONS: Record<string, string> = {
  asr: '🎤',
  ocr: '📸',
  multi_account: '💳',
  csv_export: '📤',
};

const AMOUNT_LABELS: Record<string, string> = {
  asr: '次',
  ocr: '次',
  multi_account: '天',
  csv_export: '周',
};

type AdState = 'loading' | 'playing' | 'paused' | 'error' | 'idle';

export default function RevenueScreen() {
  const insets = useSafeAreaInsets();
  const [adState, setAdState] = useState<AdState>('idle');
  const [errorCount, setErrorCount] = useState(0);
  const isPausedRef = useRef(false);
  const isActiveRef = useRef(true);

  const { data: watchCount = 0 } = useAdWatchCount();
  const { data: entitlements = [] } = useEntitlements();
  const { mutateAsync: recordWatch } = useRecordAdWatch();

  // 下一个奖励
  const nextReward = getRewardForWatch(watchCount + 1);
  const nextLabel = FEATURE_LABELS[nextReward.feature];
  const nextIcon = FEATURE_ICONS[nextReward.feature];
  const nextAmount = nextReward.amount;
  const nextUnit = AMOUNT_LABELS[nextReward.feature];

  // 当前循环中的进度（4 个一循环）
  const posInCycle = watchCount % FEATURES.length;

  const loadAndPlay = useCallback(async () => {
    if (isPausedRef.current || !isActiveRef.current) return;
    setAdState('loading');
    try {
      await ExpoPangle.loadRewardedVideo(REWARDED_SLOT_ID);
      if (isPausedRef.current || !isActiveRef.current) return;
      setAdState('playing');
      const result = await ExpoPangle.showRewardedVideo();
      if (result.success) {
        await recordWatch({ slotId: REWARDED_SLOT_ID, durationSec: null });
        setErrorCount(0);
        // 自动加载下一条
        loadAndPlay();
      } else {
        setAdState('idle');
      }
    } catch {
      setErrorCount((prev) => {
        const next = prev + 1;
        if (next >= 3) {
          setAdState('error');
        } else {
          // 3 秒后重试
          setTimeout(() => loadAndPlay(), 3000);
        }
        return next;
      });
    }
  }, [recordWatch]);

  // 进入页面自动开始
  useEffect(() => {
    isActiveRef.current = true;
    if (!isPausedRef.current) {
      loadAndPlay();
    }
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  // 后台/前台切换
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        isActiveRef.current = true;
        if (!isPausedRef.current && adState === 'idle') {
          loadAndPlay();
        }
      } else {
        isActiveRef.current = false;
      }
    });
    return () => sub.remove();
  }, [adState, loadAndPlay]);

  const handlePauseResume = () => {
    if (isPausedRef.current) {
      isPausedRef.current = false;
      setAdState('idle');
      loadAndPlay();
    } else {
      isPausedRef.current = true;
      setAdState('paused');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" backgroundColor={colors.cream} />

      {/* Header */}
      <View style={styles.header}>
        <AppText size="5xl" weight="bold" color={colors.text}>收益</AppText>
        <View style={styles.headerRight}>
          <AppText size="base" color={colors.textLight}>累计观看</AppText>
          <View style={styles.countBadge}>
            <AppText size="lg" weight="bold" color={colors.white}>{watchCount}</AppText>
          </View>
        </View>
      </View>

      {/* 广告播放区域 */}
      <View style={styles.adContainer}>
        {adState === 'loading' && (
          <View style={styles.adCenter}>
            <AppText size="3xl">🎬</AppText>
            <AppText size="xl" color={colors.textLight} style={styles.adText}>加载中...</AppText>
          </View>
        )}
        {adState === 'playing' && (
          <View style={styles.adCenter}>
            <AppText size="3xl">▶️</AppText>
            <AppText size="xl" color={colors.textLight} style={styles.adText}>广告播放中...</AppText>
          </View>
        )}
        {adState === 'paused' && (
          <View style={styles.adCenter}>
            <AppText size="3xl">⏸️</AppText>
            <AppText size="xl" color={colors.textLight} style={styles.adText}>已暂停</AppText>
            <AppText size="base" color={colors.textLighter} style={styles.adText}>点击下方按钮继续</AppText>
          </View>
        )}
        {adState === 'error' && (
          <View style={styles.adCenter}>
            <AppText size="3xl">😴</AppText>
            <AppText size="xl" color={colors.textLight} style={styles.adText}>暂无广告，稍后再试</AppText>
            <TouchableOpacity
              style={styles.retryBtn}
              activeOpacity={0.7}
              onPress={() => { setErrorCount(0); loadAndPlay(); }}
            >
              <AppText size="lg" weight="medium" color={colors.sage}>重试</AppText>
            </TouchableOpacity>
          </View>
        )}
        {adState === 'idle' && (
          <View style={styles.adCenter}>
            <AppText size="3xl">🎬</AppText>
            <AppText size="xl" color={colors.textLight} style={styles.adText}>
              观看广告，免费解锁高级功能
            </AppText>
          </View>
        )}
      </View>

      {/* 下一个奖励进度 */}
      <View style={styles.bottomSection}>
        <Card style={styles.rewardCard}>
          <View style={styles.rewardRow}>
            <AppText size="2xl">{nextIcon}</AppText>
            <View style={styles.rewardInfo}>
              <AppText size="lg" weight="medium" color={colors.text}>
                下一个奖励: {nextLabel}
              </AppText>
              <AppText size="base" color={colors.textLight}>
                +{nextAmount} {nextUnit}
              </AppText>
            </View>
          </View>
          {/* 进度条 */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(posInCycle / FEATURES.length) * 100}%` }]} />
          </View>
          <AppText size="sm" color={colors.textLighter} style={styles.progressLabel}>
            本轮进度 {posInCycle}/{FEATURES.length}
          </AppText>
        </Card>

        {/* 控制按钮 */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlBtn, isPausedRef.current && styles.controlBtnActive]}
            activeOpacity={0.7}
            onPress={handlePauseResume}
          >
            <AppText size="lg" weight="medium" color={isPausedRef.current ? colors.white : colors.text}>
              {isPausedRef.current ? '▶ 继续' : '⏸ 暂停'}
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/ad-rewards')}
          >
            <AppText size="lg" weight="medium" color={colors.text}>📋 我的权益</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countBadge: {
    backgroundColor: colors.sage, borderRadius: radii.full,
    paddingHorizontal: 10, paddingVertical: 2,
  },
  adContainer: {
    flex: 1, marginHorizontal: 20, marginVertical: 12,
    backgroundColor: colors.white, borderRadius: radii.xl,
    ...shadows.md,
    justifyContent: 'center', alignItems: 'center',
  },
  adCenter: { alignItems: 'center', gap: 12 },
  adText: { textAlign: 'center' },
  retryBtn: {
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.sage,
  },
  bottomSection: { paddingHorizontal: 20, paddingBottom: 100 },
  rewardCard: { marginBottom: 12 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  rewardInfo: { flex: 1, gap: 2 },
  progressBar: {
    height: 6, backgroundColor: colors.creamDark, borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: colors.sage, borderRadius: 3 },
  progressLabel: { marginTop: 6, textAlign: 'right' },
  controls: { flexDirection: 'row', gap: 12 },
  controlBtn: {
    flex: 1, paddingVertical: 14, borderRadius: radii.lg,
    backgroundColor: colors.white, alignItems: 'center',
    ...shadows.sm,
  },
  controlBtnActive: { backgroundColor: colors.sage },
});
```

- [ ] **Step 2: 运行现有测试确认没有回归**

Run: `cd apps/mobile && npx jest --no-cache`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/app/\(tabs\)/bills.tsx
git commit -m "feat(ad-feed): 收益 Tab 替换为广告信息流页面

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: 功能门控组件 + 接入

**Files:**
- Create: `apps/mobile/components/shared/EntitlementGate.tsx`
- Modify: `apps/mobile/hooks/useChat.ts`
- Modify: `apps/mobile/components/profile/ExportSheet.tsx`
- Modify: `apps/mobile/app/accounts.tsx`

- [ ] **Step 1: 创建权益不足弹窗组件**

```typescript
// apps/mobile/components/shared/EntitlementGate.tsx
import { Modal, View, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../ui/AppText';
import { colors, radii, spacing } from '../../constants/theme';

interface EntitlementGateProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly featureLabel: string;
}

export function EntitlementGate({ visible, onClose, featureLabel }: EntitlementGateProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
          <View style={styles.header}>
            <AppText size="2xl" weight="semibold">权益不足</AppText>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <AppText size="2xl" color={colors.textLighter}>✕</AppText>
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <AppText size="3xl" style={styles.icon}>🔒</AppText>
            <AppText size="xl" weight="medium" color={colors.text} style={styles.msg}>
              {featureLabel}需要权益才能使用
            </AppText>
            <AppText size="base" color={colors.textLight} style={styles.msg}>
              观看广告即可免费解锁，或升级 Pro 无限使用
            </AppText>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.adBtn}
              activeOpacity={0.8}
              onPress={() => { onClose(); router.push('/(tabs)/bills'); }}
            >
              <AppText size="xl" weight="semibold" color={colors.white}>🎬 去看广告</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.proBtn}
              activeOpacity={0.8}
              onPress={() => { onClose(); router.push('/upgrade-pro'); }}
            >
              <AppText size="xl" weight="semibold" color={colors.sage}>👑 升级 Pro</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  overlayTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xxl, paddingTop: spacing.xxl, paddingBottom: spacing.lg,
  },
  body: { alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl, gap: 8 },
  icon: { marginBottom: 4 },
  msg: { textAlign: 'center' },
  buttons: { paddingHorizontal: spacing.xxl, gap: 12 },
  adBtn: {
    backgroundColor: colors.sage, borderRadius: radii.lg,
    paddingVertical: 16, alignItems: 'center',
  },
  proBtn: {
    borderWidth: 1, borderColor: colors.sage, borderRadius: radii.lg,
    paddingVertical: 16, alignItems: 'center',
  },
});
```

- [ ] **Step 2: 在 useChat 中添加 ASR/OCR 门控**

修改 `apps/mobile/hooks/useChat.ts`：

在文件顶部新增导入：
```typescript
import { getEntitlement } from '@/lib/entitlements/queries';
```

**方案：不改 useChat 的返回类型**（避免破坏性变更），而是新增一个独立的检查函数，在调用方（ChatInputBar）中先检查权益再调用 sendAsr/sendOcr。

在 `apps/mobile/hooks/useEntitlement.ts` 末尾添加：

```typescript
/**
 * 检查功能权益是否可用。
 * 返回 true 表示可以使用，false 表示权益不足。
 * 如果可用，同时扣减 1 次（仅限 asr/ocr 按次计费的功能）。
 */
export function useCheckAndConsume() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useCallback(async (feature: FeatureKey): Promise<boolean> => {
    if (!db) return false;
    // TODO: Pro check — Pro 用户直接返回 true
    const ent = await getEntitlement(db, feature);
    if (ent.balance <= 0) return false;
    // 按次计费的功能立即扣减
    if (feature === 'asr' || feature === 'ocr') {
      await consumeEntitlement(db, feature);
      qc.invalidateQueries({ queryKey: ['entitlements'] });
    }
    return true;
  }, [db, qc]);
}
```

在调用方（如 `ChatInputBar.tsx`）中使用：
```typescript
import { useCheckAndConsume } from '../../hooks/useEntitlement';
import { EntitlementGate } from '../shared/EntitlementGate';

// 在组件中
const checkAndConsume = useCheckAndConsume();
const [gateFeature, setGateFeature] = useState<string | null>(null);

// 发送语音前
const handleSendAsr = async (audioBase64: string, duration: number) => {
  const allowed = await checkAndConsume('asr');
  if (!allowed) { setGateFeature('asr'); return; }
  sendAsr(audioBase64, duration);
};

// 发送 OCR 前
const handleSendOcr = async (imageBase64: string) => {
  const allowed = await checkAndConsume('ocr');
  if (!allowed) { setGateFeature('ocr'); return; }
  sendOcr(imageBase64);
};

// JSX 中
<EntitlementGate
  visible={!!gateFeature}
  onClose={() => setGateFeature(null)}
  featureLabel={gateFeature === 'asr' ? '语音记账' : '小票识别'}
/>
```

这样不修改 useChat 的 API，门控逻辑完全在调用方处理。

- [ ] **Step 3: 在 ExportSheet 中添加 CSV 导出门控**

修改 `apps/mobile/components/profile/ExportSheet.tsx`：

在 `handleExport` 函数开头添加权益检查：

```typescript
import { getEntitlement, consumeEntitlement } from '../../lib/entitlements/queries';

// 在 handleExport 中，setExporting(true) 之前：
const csvEntitlement = await getEntitlement(db!, 'csv_export');
if (csvEntitlement.balance <= 0) {
  // 通过 callback 通知父组件显示门控弹窗
  onBlocked?.();
  return;
}
```

导出成功后不需要扣减（csv_export 是按周的，不是按次）。

注意：ExportSheet 的 props 需要新增 `onBlocked?: () => void`。

- [ ] **Step 4: 在 accounts 页面添加多账户门控**

修改 `apps/mobile/app/accounts.tsx`：

在文件顶部新增导入：
```typescript
import { useState } from 'react';
import { getEntitlement } from '../lib/entitlements/queries';
import { EntitlementGate } from '../components/shared/EntitlementGate';
```

在 `AccountsScreen` 组件中添加门控状态和检查逻辑：
```typescript
const [showGate, setShowGate] = useState(false);

// 替换原 "添加账户" 按钮的 onPress（第 119 行）
const handleAddAccount = async () => {
  if (!db) return;
  // TODO: Pro check
  const ent = await getEntitlement(db, 'multi_account');
  if (ent.balance <= 0) {
    setShowGate(true);
    return;
  }
  router.push('/account-edit');
};
```

将第 119 行 `onPress={() => router.push("/account-edit")}` 替换为 `onPress={handleAddAccount}`。

在 return JSX 末尾（`</View>` 之前）添加：
```typescript
<EntitlementGate
  visible={showGate}
  onClose={() => setShowGate(false)}
  featureLabel="多账户管理"
/>
```

- [ ] **Step 5: 运行测试确认没有回归**

Run: `cd apps/mobile && npx jest --no-cache`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add apps/mobile/components/shared/EntitlementGate.tsx apps/mobile/hooks/useChat.ts apps/mobile/components/profile/ExportSheet.tsx apps/mobile/app/accounts.tsx
git commit -m "feat(entitlements): 功能门控 — ASR/OCR/多账户/CSV 导出权益检查

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: 更新广告收益说明页

**Files:**
- Modify: `apps/mobile/app/ad-rewards.tsx`

- [ ] **Step 1: 更新 ad-rewards.tsx 规则说明**

修改 `apps/mobile/app/ad-rewards.tsx`：

1. 解锁规则从 3 个改为 4 个（新增 CSV 导出）
2. 更新累积规则说明（4 个一循环）
3. 添加权益余额实时显示

在解锁规则的 Card 中，在 `多账户管理` 之后添加第 4 个 AdRow：

```typescript
<View style={styles.divider} />
<AdRow
  number={4}
  text="导出 CSV"
  desc="将全部记账记录导出为 CSV 文件，每次解锁 1 周导出权限"
/>
```

更新累积规则中的循环说明：
```typescript
<AppText size="base" color={colors.textLight} style={styles.ruleDesc}>
  每 4 条广告为一轮循环：语音记账 → 小票识别 → 多账户管理（7天）→ 导出 CSV（1周）
</AppText>
```

在顶部导入权益 hooks，显示当前余额：
```typescript
import { useEntitlements, useAdWatchCount } from '../hooks/useEntitlement';
```

在说明区域下方添加"我的权益"卡片，展示 4 个功能的当前余额。

- [ ] **Step 2: 运行测试确认没有回归**

Run: `cd apps/mobile && npx jest --no-cache`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/app/ad-rewards.tsx
git commit -m "feat(ad-rewards): 更新规则说明 — 4个功能一循环，新增CSV导出

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: 集成验证 + EAS Build 配置

**Files:**
- 无新文件，验证性任务

- [ ] **Step 1: 确认所有测试通过**

Run: `cd apps/mobile && npx jest --no-cache`
Expected: 全部 PASS

- [ ] **Step 2: 确认 TypeScript 编译无错误**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交并推送分支**

```bash
git push -u origin worktree-feat-ad
```

- [ ] **Step 4: 创建 EAS Build 进行原生模块验证**

```bash
cd apps/mobile && npx eas build --platform all --profile development
```

> **注意：** 穿山甲 SDK 只能在真机上测试（模拟器不支持广告展示）。首次 EAS Build 用于验证原生模块编译通过、Config Plugin 配置正确。广告展示功能需在真机上手动验证。

- [ ] **Step 5: 配置穿山甲后台**

需要用户在穿山甲开放平台 (https://www.csjplatform.com) 完成以下操作：
1. 注册开发者账号
2. 创建应用（iOS + Android）
3. 创建开屏广告位 → 获取 SPLASH_SLOT_ID
4. 创建激励视频广告位 → 获取 REWARDED_SLOT_ID
5. 获取 APP_ID
6. 将这些 ID 替换代码中的 `YOUR_APP_ID`、`YOUR_SPLASH_SLOT`、`YOUR_REWARDED_SLOT` 占位符

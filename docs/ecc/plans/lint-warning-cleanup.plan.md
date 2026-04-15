# Plan: 前端 ESLint Warning 清零 & 规则升级

## Summary
一次性修复 apps/mobile 中全部 51 个 ESLint warning（30 个 no-explicit-any、12 个 no-unused-vars、9 个废弃 eslint-disable 指令），然后将规则从 warn 升级为 error，建立类型安全质量门禁。

## User Story
As a 前端开发者,
I want CI 中 ESLint 的 warning 清零并升级为 error,
So that 新代码无法引入 any 或未使用变量，保持代码库长期可维护性。

## Problem → Solution
51 个被忽视的 lint warning + warn 级别不阻断 CI → 零 warning + error 级别硬门禁

## Metadata
- **Complexity**: Medium
- **Source PRD**: `docs/ecc/prds/lint-warning-cleanup.prd.md`
- **PRD Phase**: All 3 phases (Quick Wins + Type Annotations + Config Hardening)
- **Estimated Files**: 22 files (21 source + 1 config)

---

## UX Design

N/A — 纯内部代码质量变更，无用户界面变化。

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `apps/mobile/eslint.config.js` | all | 需要最终修改规则级别 |
| P0 | `packages/shared/src/types/category.ts` | all | Category 类型定义，多处 any 替换需要 |
| P0 | `packages/shared/src/types/transaction.ts` | all | Transaction / UpdateTransactionInput 类型定义 |
| P0 | `apps/mobile/utils/insights/types.ts` | all | InsightItem.meta 类型需重新设计 |
| P1 | `apps/mobile/hooks/useChat.ts` | 12-38 | ChatResponse 类型已定义，apiFetch 泛型可直接使用 |
| P1 | `apps/mobile/hooks/useLocalCategories.ts` | 1-20 | 返回 `readonly Category[]`，确认下游类型推断 |

---

## Patterns to Mirror

### CATCH_ERROR_PATTERN
```typescript
// 项目中应统一使用 unknown + instanceof 收窄
// SOURCE: ~/.claude/rules/typescript/coding-style.md
catch (e: unknown) {
  const message = e instanceof Error ? e.message : "未知错误";
  Alert.alert("失败", message);
}
```

### UNUSED_ARG_CONVENTION
```typescript
// SOURCE: apps/mobile/eslint.config.js:30-32
// 未使用参数加 _ 前缀，符合 argsIgnorePattern: "^_"
function handler(_event: DateTimePickerEvent, selectedDate?: Date) { ... }
```

### CATEGORY_TYPE_IMPORT
```typescript
// SOURCE: apps/mobile/hooks/useLocalCategories.ts:3
import type { Category } from "@coco/shared";
// useLocalCategories() 返回 UseQueryResult<readonly Category[]>
```

### TEST_PARTIAL_PATTERN
```typescript
// 测试文件中用 Partial<T>[] 替代 any[]，宽松但类型安全
const txs: Partial<Transaction>[] = [
  { occurred_at: "2026-03-01", type: "expense", amount: "100" },
];
```

---

## Files to Change

| File | Action | Warning 类型 | 数量 |
|---|---|---|---|
| `apps/mobile/app/(tabs)/auto-guide.tsx` | UPDATE | 废弃指令 ×9, unused-vars ×2 | 11 |
| `apps/mobile/app/_layout.tsx` | UPDATE | unused-vars ×1 | 1 |
| `apps/mobile/app/(auth)/login.tsx` | UPDATE | no-explicit-any ×1 | 1 |
| `apps/mobile/app/(auth)/register.tsx` | UPDATE | no-explicit-any ×1 | 1 |
| `apps/mobile/app/manual-entry.tsx` | UPDATE | no-explicit-any ×4 | 4 |
| `apps/mobile/components/CategoryPicker.tsx` | UPDATE | no-explicit-any ×4 | 4 |
| `apps/mobile/components/ManualEntryForm.tsx` | UPDATE | unused-vars ×2, no-explicit-any ×3 | 5 |
| `apps/mobile/components/ExternalLink.tsx` | UPDATE | no-explicit-any ×1 | 1 |
| `apps/mobile/components/auth/AuthButton.tsx` | UPDATE | unused-vars ×1 | 1 |
| `apps/mobile/components/chat/ChatInputBar.tsx` | UPDATE | unused-vars ×1 | 1 |
| `apps/mobile/components/home/HeaderGreeting.tsx` | UPDATE | unused-vars ×1 | 1 |
| `apps/mobile/components/profile/ProfileHeader.tsx` | UPDATE | unused-vars ×1 | 1 |
| `apps/mobile/components/shared/BottomTabBar.tsx` | UPDATE | no-explicit-any ×1 | 1 |
| `apps/mobile/components/stats/AccountSelectorBar.tsx` | UPDATE | no-explicit-any ×1 | 1 |
| `apps/mobile/components/stats/InsightCard.tsx` | UPDATE | no-explicit-any ×6 | 6 |
| `apps/mobile/hooks/useChat.ts` | UPDATE | no-explicit-any ×1 | 1 |
| `apps/mobile/hooks/useLocalTransactions.ts` | UPDATE | no-explicit-any ×1 | 1 |
| `apps/mobile/lib/auto-bookkeeping/brand-detection.ts` | UPDATE | no-explicit-any ×1 | 1 |
| `apps/mobile/lib/sync/sync-service.ts` | UPDATE | unused-vars ×1 | 1 |
| `apps/mobile/utils/__tests__/statsUtils.test.ts` | UPDATE | no-explicit-any ×6 | 6 |
| `apps/mobile/utils/insights/types.ts` | UPDATE | no-explicit-any ×1 | 1 |
| `apps/mobile/eslint.config.js` | UPDATE | 规则升级 | - |

## NOT Building

- 不重构任何组件逻辑或数据流
- 不添加新的类型导出到 `@coco/shared`（除非必要的 meta 类型）
- 不修改后端代码
- 不引入新的依赖包

---

## Step-by-Step Tasks

### Task 1: 清除废弃 eslint-disable 指令 (auto-guide.tsx)

- **ACTION**: 删除 9 个 `// eslint-disable-next-line @typescript-eslint/no-var-requires` 注释
- **IMPLEMENT**: 删除第 22, 24, 26, 28, 30, 32, 34, 36, 38 行的 eslint-disable 注释。`@typescript-eslint/no-require-imports` 已在 eslint.config.js 中设为 `"off"`，所以 `no-var-requires`（已被取代）不会报错，这些 disable 指令完全多余。
- **GOTCHA**: 确保只删除注释行，不改动 require() 语句本身
- **VALIDATE**: `pnpm lint 2>&1 | grep "auto-guide"` — 应该只剩 unused-vars warning

### Task 2: 清除 unused-vars (12 个)

- **ACTION**: 对 12 个 unused-vars warning 逐一处理

| 文件 | 变量 | 修复方式 |
|---|---|---|
| `auto-guide.tsx:16` | `spacing` | 从 import 中移除 `spacing` |
| `auto-guide.tsx:159` | `guideSteps` | 删除 `const guideSteps = getBrandGuideSteps(brand);` 以及 import 中的 `getBrandGuideSteps`（如果不再被使用） |
| `_layout.tsx:46` | `isAuthenticated` | 从解构中移除：`const { user, loading } = useAuth();` |
| `ManualEntryForm.tsx:11` | `KeyboardAvoidingView` | 从 import 中移除 |
| `ManualEntryForm.tsx:12` | `Platform` | 从 import 中移除 |
| `AuthButton.tsx:5` | `PressableProps` | 从 import 中移除 `type PressableProps` |
| `ChatInputBar.tsx:43` | `recordingState` | 重命名为 `_recordingState`（函数参数，需保留占位） |
| `HeaderGreeting.tsx:23` | `WEATHER_EMOJI` | 删除 `const WEATHER_EMOJI = [...]` 声明 |
| `ProfileHeader.tsx:22` | `onSettingsPress` | 重命名为 `_onSettingsPress`（解构参数，接口中保留）|
| `sync-service.ts:310` | `userId` | 重命名为 `_userId`（函数参数，需保留签名） |

- **GOTCHA**:
  - `auto-guide.tsx` 的 `guideSteps` — 先确认没有其他地方引用它。如果 `getBrandGuideSteps` 只在这里调用，同时从 import 中移除
  - `_layout.tsx` 的 `isAuthenticated` — 确认 `useAuth()` 返回值中移除它不影响其他逻辑
  - `ChatInputBar.tsx` 的 `recordingState` — 检查是否在函数体内真的没有使用
  - `ProfileHeader.tsx` 的 `onSettingsPress` — 它在 Props 接口中定义为可选，但解构后未使用。加 `_` 前缀保留接口兼容性
- **VALIDATE**: `pnpm lint 2>&1 | grep "no-unused-vars"` — 应返回 0 结果

### Task 3: 修复 catch (e: any) → catch (e: unknown) (2 个)

- **ACTION**: 修改 login.tsx 和 register.tsx 的 catch 块

- **IMPLEMENT**:

`app/(auth)/login.tsx:34`:
```typescript
// BEFORE:
} catch (e: any) {
  Alert.alert("登录失败", e.message);
// AFTER:
} catch (e: unknown) {
  Alert.alert("登录失败", e instanceof Error ? e.message : "未知错误");
```

`app/(auth)/register.tsx:41`:
```typescript
// BEFORE:
} catch (e: any) {
  Alert.alert("注册失败", e.message);
// AFTER:
} catch (e: unknown) {
  Alert.alert("注册失败", e instanceof Error ? e.message : "未知错误");
```

- **MIRROR**: CATCH_ERROR_PATTERN
- **VALIDATE**: `pnpm lint 2>&1 | grep -E "login|register"` — 应返回 0 结果

### Task 4: 修复 Category 回调参数 any (11 个)

- **ACTION**: 替换 CategoryPicker、ManualEntryForm、manual-entry 中的 `(c: any)` 回调参数

- **IMPLEMENT**:

**CategoryPicker.tsx** — `useLocalCategories()` 返回 `readonly Category[]`，所以 allCategories 的元素就是 `Category`：
```typescript
// 第 27 行: .filter((c: any) => ...) → .filter((c) => ...)
// 第 28 行: .sort((a: any, b: any) => ...) → .sort((a, b) => ...)
// 第 45 行: categories.map((cat: any) => ...) → categories.map((cat) => ...)
```
由于 `allCategories` 已经是 `Category[]`，TypeScript 可以自动推断回调参数类型，直接删除 `: any` 类型注解即可。

**ManualEntryForm.tsx** — 同理，`categories` 来自 `useLocalCategories()`：
```typescript
// 第 61 行: (c: any) → (c)
// 第 84 行: (c: any) → (c)
```

**manual-entry.tsx** — 需先确认 `categories` 变量来源：
```typescript
// 第 126 行: (c: any) → (c)
// 第 135 行: (c: any) → (c)
// 第 172 行: (c: any) → (c)
```

- **IMPORTS**: 无需新增 import，回调参数类型由数组元素类型自动推断
- **GOTCHA**: 确认 `manual-entry.tsx` 中 `categories` 也来自 `useLocalCategories()`，否则需要显式标注
- **VALIDATE**: `pnpm lint 2>&1 | grep -E "CategoryPicker|ManualEntryForm|manual-entry"` — 应无 any warning

### Task 5: 修复 ManualEntryForm onSuccess 回调 any (1 个)

- **ACTION**: `ManualEntryForm.tsx:23` 的 `onSuccess?: (tx: any) => void`

- **IMPLEMENT**: 查看 `onSuccess` 实际调用时传入的值。在 ManualEntryForm 中，`createTransaction` 返回的是一个 txId (string)，然后构造对象传给 onSuccess。定义具体类型：
```typescript
interface CreatedTransaction {
  id: string;
  amount: number;
  type: "expense" | "income";
  note: string;
  categoryName: string;
  occurred_at: string;
}

interface Props {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSuccess?: (tx: CreatedTransaction) => void;
}
```

- **GOTCHA**: 需要确认 ManualEntryForm 中 `onSuccess` 被调用时传入的确切结构，然后再定义类型
- **VALIDATE**: 确认类型匹配实际传入值

### Task 6: 修复 DateTimePicker 回调 any (1 个)

- **ACTION**: `manual-entry.tsx:153` 的 `handleDateChange(_event: any, selectedDate?: Date)`

- **IMPLEMENT**:
```typescript
// 需要导入 DateTimePickerEvent 类型
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";

// 第 153 行:
function handleDateChange(_event: DateTimePickerEvent, selectedDate?: Date) {
```

- **IMPORTS**: `import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";`
- **GOTCHA**: 先确认项目安装了 `@react-native-community/datetimepicker`。如果没有，用 `unknown` 替代
- **VALIDATE**: 类型检查通过

### Task 7: 修复 ExternalLink href any (1 个)

- **ACTION**: `ExternalLink.tsx:13` 的 `href={props.href as any}`

- **IMPLEMENT**: expo-router 的 `Link` 组件期望 `Href` 类型。由于 props 已将 href 声明为 `string`，而 `Href` 接受 string，可以直接传：
```typescript
// BEFORE:
href={props.href as any}
// AFTER:
href={props.href as Href}
```
但更好的方案是直接去掉断言，因为 `Href` 类型定义为 `string | HrefObject`，string 本身就兼容：
```typescript
// 最简方案 — 改 props 类型定义:
export function ExternalLink(
  props: Omit<React.ComponentProps<typeof Link>, "href"> & { href: string },
) {
  return (
    <Link
      target="_blank"
      {...props}
      href={props.href as Href}
```

- **IMPORTS**: `import type { Href } from "expo-router";`
- **GOTCHA**: expo-router 的 `Href` 在不同版本中可能是泛型。如果 `as Href` 报错，尝试 `as Href<string>`
- **VALIDATE**: 类型检查 + 确认 ExternalLink 在 app 中正常工作

### Task 8: 修复 BottomTabBar props any (1 个)

- **ACTION**: `BottomTabBar.tsx:53` 的 `{ state, descriptors, navigation }: any`

- **IMPLEMENT**: `@react-navigation/bottom-tabs` 已作为 expo-router 的依赖安装。导入 `BottomTabBarProps`：
```typescript
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

export function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
```

- **IMPORTS**: `import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";`
- **GOTCHA**: `BottomTabBarProps` 包含 `insets` 属性，但当前解构中没有使用。这没问题，TypeScript 允许部分解构。`state.routes` 的元素类型已内置，所以下方 `route: any` 也能自动修复。
- **VALIDATE**: 确认 `state.routes.map((route: any, ...)` 中的 `any` 也能因此消除（route 类型自动推断为 `RouteProp<ParamListBase>`），如果不能，需单独处理

### Task 9: 修复 InsightCard meta any (6 个) + types.ts meta any (1 个)

- **ACTION**: InsightCard.tsx 中 5 个子组件的 `meta: Record<string, any>` + InsightCard 本身的 `pathname: ... as any`，以及 types.ts 中的 `meta?: Record<string, any>`

- **IMPLEMENT**:

**Step 9a**: 在 `utils/insights/types.ts` 中定义具体的 Meta 类型：
```typescript
export interface CompareRowMeta {
  readonly currentAmount: number;
  readonly previousAmount: number;
}

export interface AnomalyMeta {
  readonly date: string;
  readonly amount: number;
  readonly categoryEmoji: string;
  readonly categoryName: string;
}

export interface PaceMeta {
  readonly spendProgress: number;
}

export interface FrequencyMeta {
  readonly count: number;
}

export interface SavingMeta {
  readonly totalSaving: number;
}

export type InsightMeta = CompareRowMeta | AnomalyMeta | PaceMeta | FrequencyMeta | SavingMeta;

export interface InsightItem {
  // ...
  readonly meta?: InsightMeta;
}
```

**Step 9b**: 更新 InsightCard.tsx 中的子组件签名：
```typescript
function CompareRow({ meta }: { meta: CompareRowMeta }) { ... }
function AnomalyDetail({ meta }: { meta: AnomalyMeta }) { ... }
function PaceBar({ meta }: { meta: PaceMeta }) { ... }
function FrequencyDots({ meta }: { meta: FrequencyMeta }) { ... }
function SavingHighlight({ meta }: { meta: SavingMeta }) { ... }
```

**Step 9c**: `InsightCard.tsx:172` 的 `pathname: item.navigation.route as any` — `InsightNavigation.route` 已定义为 `string`，expo-router 的 `router.push` 接受 `Href`。修复：
```typescript
router.push({
  pathname: item.navigation.route as Href,
  params: item.navigation.params,
});
```

- **IMPORTS**: `import type { CompareRowMeta, AnomalyMeta, PaceMeta, FrequencyMeta, SavingMeta } from "../../utils/insights/types";` 以及 `import type { Href } from "expo-router";`
- **GOTCHA**: InsightCard 中传 meta 给子组件前需要类型收窄。InsightItem.meta 是联合类型，但子组件期望具体类型。需要在渲染逻辑中确保 meta 被正确断言。查看 InsightCard 的渲染逻辑，它根据 `item.type` 选择子组件，所以可以用 `as CompareRowMeta` 等断言（因为 item.type 已经确定了 meta 的实际类型）
- **GOTCHA**: 需同步检查生成 InsightItem 的 insight rule 文件，确认 meta 字段确实符合新类型
- **VALIDATE**: `pnpm lint 2>&1 | grep "InsightCard\|types.ts"` — 应无 any warning

### Task 10: 修复 AccountSelectorBar style any (1 个)

- **ACTION**: `AccountSelectorBar.tsx:479` 的 `width: "30%" as any`

- **IMPLEMENT**:
```typescript
// BEFORE:
width: "30%" as any,
// AFTER:
width: "30%" as DimensionValue,
```

- **IMPORTS**: `import type { DimensionValue } from "react-native";`
- **GOTCHA**: React Native 的 `ViewStyle.width` 接受 `DimensionValue`（`number | string | "auto" | undefined`）。百分比字符串是合法的 `DimensionValue`，所以实际上可能根本不需要断言——试试直接删除 `as any`。如果 TypeScript 报错（因为 StyleSheet.create 中百分比字符串推断为 `string` 而非 `DimensionValue`），再加 `as DimensionValue`。
- **VALIDATE**: 类型检查通过

### Task 11: 修复 useChat apiFetch any (1 个)

- **ACTION**: `useChat.ts:181` 的 `apiFetch<any>("/record-ocr", ...)`

- **IMPLEMENT**: useChat.ts 已定义 `ChatResponse` 类型（第 36-38 行），直接使用：
```typescript
// BEFORE:
const resp = await apiFetch<any>("/record-ocr", {
// AFTER:
const resp = await apiFetch<ChatResponse>("/record-ocr", {
```

- **IMPORTS**: 无需新增 import，`ChatResponse` 在同文件定义
- **GOTCHA**: `apiFetch<T>` 返回 `Promise<T>`，所以 `resp` 类型变为 `ChatResponse`。后续 `resp.data?.type` 等访问已经和 `ChatResponse` 定义一致
- **VALIDATE**: 类型检查通过

### Task 12: 修复 useLocalTransactions account_id any (1 个)

- **ACTION**: `useLocalTransactions.ts:148` 的 `values.push(params.account_id as any)`

- **IMPLEMENT**: `values` 声明为 `(string | number)[]`，而 `params.account_id` 类型是 `string | null | undefined`。null 不兼容 `string | number`。修改 values 声明以支持 null：
```typescript
// 第 125 行:
// BEFORE:
const values: (string | number)[] = [];
// AFTER:
const values: (string | number | null)[] = [];
// 第 148 行:
// BEFORE:
values.push(params.account_id as any);
// AFTER:
values.push(params.account_id ?? null);
```

- **GOTCHA**: SQLite 的 `runAsync` 接受参数类型为 `SQLiteBindValue[]`，其中 `SQLiteBindValue = string | number | null | Uint8Array`。所以 null 是合法的 SQL 参数值。确认 `(string | number | null)[]` 兼容 `SQLiteBindValue[]`
- **VALIDATE**: 类型检查通过

### Task 13: 修复 brand-detection Platform.constants any (1 个)

- **ACTION**: `brand-detection.ts:76` 的 `(Platform.constants as any)?.Brand`

- **IMPLEMENT**: React Native 的 `Platform.constants` 在 Android 上包含额外属性（如 Brand），但类型定义不包含。使用 Record 类型收窄：
```typescript
// BEFORE:
const brand = (Platform.constants as any)?.Brand?.toLowerCase() ?? "";
// AFTER:
const brand =
  ((Platform.constants as Record<string, unknown>)?.Brand as string | undefined)
    ?.toLowerCase() ?? "";
```

或更简洁的方式：
```typescript
const constants = Platform.constants as Record<string, unknown>;
const brand = (typeof constants.Brand === "string" ? constants.Brand : "").toLowerCase();
```

- **GOTCHA**: `Platform.constants` 的类型在 Android 和 iOS 不同。确保类型收窄不影响 iOS 路径（已有 `if (Platform.OS !== "android") return "default"` 守卫）
- **VALIDATE**: 类型检查通过

### Task 14: 修复测试文件 any (6 个)

- **ACTION**: `statsUtils.test.ts` 中 6 个 `as any` / `as any[]`

- **IMPLEMENT**: 使用 `Partial<T>` 宽松处理测试数据：
```typescript
import type { Transaction, Category } from "@coco/shared";

// 第 57 行: ] as any[] → ] as Partial<Transaction>[]
// 第 78 行: ] as any[] → ] as Partial<Transaction>[]
// 第 90 行: } as any → } as Record<string, Partial<Category>>
// 第 95 行: ] as any[] → ] as Partial<Transaction>[]
// 第 120 行: } as any → } as Record<string, Partial<Category>>
// 第 138 行: ] as any[] → ] as Partial<Transaction>[]
```

- **IMPORTS**: `import type { Transaction, Category } from "@coco/shared";`
- **GOTCHA**: `buildDailyData`、`buildCategoryStats`、`buildTransactionRank` 函数的参数类型可能期望完整的 `Transaction[]` 而非 `Partial<Transaction>[]`。如果类型不兼容，可能需要改为更宽松的断言方式，比如用一个本地 `type TestTransaction = Pick<Transaction, "occurred_at" | "type" | "amount">` 然后 `as TestTransaction[]`。或者最简单：保持 `as unknown as Transaction[]`（两步断言替代 `as any`）
- **VALIDATE**: `pnpm lint 2>&1 | grep "statsUtils"` — 应无 any warning

### Task 15: 升级 ESLint 规则 warn → error

- **ACTION**: 修改 `eslint.config.js` 中的规则级别

- **IMPLEMENT**:
```javascript
// BEFORE:
"@typescript-eslint/no-unused-vars": [
  "warn",
  { argsIgnorePattern: "^_" },
],
"@typescript-eslint/no-explicit-any": "warn",

// AFTER:
"@typescript-eslint/no-unused-vars": [
  "error",
  { argsIgnorePattern: "^_" },
],
"@typescript-eslint/no-explicit-any": "error",
```

同时更新注释：
```javascript
// BEFORE: // 存量 25 个 any，一次修完不现实，先警告提醒后续清理
// AFTER: // 已清零并升级为 error，新 any 将阻断 CI
```

- **GOTCHA**: 确保在前面所有 Task 完成后再执行此步，否则 lint 会报 error 而非 warning
- **VALIDATE**: `pnpm lint` — 应输出 0 problems (0 errors, 0 warnings)

---

## Testing Strategy

### Validation Commands

**Lint 验证（每个 Task 后执行）**:
```bash
cd apps/mobile && pnpm lint
```
EXPECT: warning 数逐步减少，最终为 0

**TypeScript 类型检查**:
```bash
cd apps/mobile && npx tsc --noEmit
```
EXPECT: 零类型错误

**全量 Lint（最终）**:
```bash
cd apps/mobile && pnpm lint
```
EXPECT: `✖ 0 problems (0 errors, 0 warnings)`

### Edge Cases Checklist
- [ ] 删除 unused var 后确认没有遗漏副作用
- [ ] `catch (e: unknown)` 后 `Alert.alert` 仍然显示有意义的错误消息
- [ ] InsightCard meta 类型收窄后，传入不符合预期的 meta 不会导致运行时崩溃
- [ ] BottomTabBar 类型化后，tab 导航仍正常工作
- [ ] 测试文件 Partial 断言后，所有测试仍然通过

---

## Acceptance Criteria
- [ ] `pnpm lint` 输出 0 problems
- [ ] `no-explicit-any` 和 `no-unused-vars` 规则已升级为 `"error"`
- [ ] 所有现有测试通过
- [ ] TypeScript 类型检查无错误
- [ ] 无运行时行为变化

## Completion Checklist
- [ ] 所有 51 个 warning 已修复
- [ ] eslint.config.js 规则从 warn 升级为 error
- [ ] 注释已更新（不再提"存量 any"）
- [ ] 未引入新的 eslint-disable 注释
- [ ] 未改变任何组件逻辑或数据流

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Partial 断言导致测试函数类型不兼容 | MEDIUM | LOW | 改用 `as unknown as T[]` 两步断言 |
| BottomTabBar 类型版本不兼容 | LOW | LOW | @react-navigation/bottom-tabs 已随 expo-router 安装 |
| InsightCard meta 类型收窄引入新 TS 错误 | MEDIUM | MEDIUM | 子组件内使用类型断言过渡 |
| expo-router Href 类型不兼容 | LOW | LOW | 回退使用 `as unknown as Href` |

## Notes
- 执行顺序建议：Task 1-2（快速清理）→ Task 3-14（类型修复）→ Task 15（配置升级）
- Task 9（InsightCard meta 类型）是最复杂的，需要仔细验证 insight rule 的 meta 结构
- Task 14（测试文件）采用宽松策略，不追求完美类型安全
- 每完成一批修改后运行 `pnpm lint` 验证进度

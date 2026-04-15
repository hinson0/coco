# 前端 ESLint Warning 清零 & 规则升级

## Problem Statement

前端 CI/CD 持续输出 51 个 ESLint warning（`no-explicit-any` 30 个、`no-unused-vars` 12 个、废弃 eslint-disable 指令 9 个），分布在 21 个旧文件中。Warning 级别的规则无法阻止新违规进入代码库，导致技术债持续累积（"warning fatigue"效应）。

## Evidence

- `pnpm lint` 输出 51 warnings / 0 errors（2026-04-15 实测）
- eslint.config.js 注释标注"存量 25 个 any"，实际已增长到 30 个
- 当前规则均为 `"warn"` 级别，CI 不会阻断，新代码可以继续引入 any

## Proposed Solution

一次性修复全部 51 个 warning，然后将 `no-explicit-any` 和 `no-unused-vars` 从 `"warn"` 升级为 `"error"`，建立真正的类型安全质量门禁。

## Key Hypothesis

We believe 清零 warning 并升级为 error 级别 will 阻止新 any 和未使用变量进入代码库 for 所有前端开发者。
We'll know we're right when CI lint 阶段在后续 10 次提交中保持 0 warning / 0 error。

## What We're NOT Building

- 全面的类型系统重构 — 只修复 lint 报告的 51 个点
- 新的 lint 规则引入 — 只处理现有两个规则的存量问题
- 后端 Python 代码的 lint 清理 — scope 仅限 apps/mobile

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Lint warning 数量 | 0 | `pnpm lint` 输出 |
| 规则级别 | error | eslint.config.js 配置 |
| 功能回归 | 0 | 现有测试 + 手动验证 |

## Open Questions

- [ ] `BottomTabBar.tsx` 的 React Navigation 类型是否需要升级 `@react-navigation/bottom-tabs` 版本才能拿到完整类型？
- [ ] `insights/types.ts` 中 `meta?: Record<string, any>` 改为联合类型后，是否需要同步更新后端 API 响应类型？

---

## Users & Context

**Primary User**
- **Who**: 项目前端开发者（当前主要是用户本人）
- **Current behavior**: 看到 51 个 warning 但习惯性忽略，新代码可能引入更多 any
- **Trigger**: CI/CD 输出中 warning 堆积到不可忽视的程度
- **Success state**: `pnpm lint` 输出干净，新的 any 或未使用变量会直接 CI 失败

**Job to Be Done**
When 提交代码时, I want to 被 ESLint 及时阻止类型安全问题, so I can 保持代码库的长期可维护性。

**Non-Users**
后端开发——本次 scope 仅限 apps/mobile 前端 TypeScript 代码。

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | 清除全部 9 个废弃 eslint-disable 指令 | `--fix` 可自动处理 |
| Must | 清除全部 12 个 no-unused-vars warning | 删除或加 `_` 前缀 |
| Must | 替换 24 个 EASY 级别的 any | 明确可推断类型 |
| Must | 替换 5 个 MEDIUM 级别的 any | 需查类型定义的渐进式替换 |
| Must | 处理 1 个 HARD 级别的 any (BottomTabBar) | React Navigation 类型 |
| Must | 升级规则 warn → error | 建立质量门禁 |
| Should | 测试文件 any 用 `Partial<T>` 而非精确类型 | 测试文件允许宽松 |
| Won't | 重构代码结构或组件逻辑 | 仅修 lint，不改行为 |

### MVP Scope

全部 51 个 warning 一次性清零 + 配置升级。

### User Flow

```
修复 warning → 运行 pnpm lint 验证 0 warning → 升级配置 → 再次验证 0 error → 提交
```

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- 70% 的 any（24/30）是简单替换（catch error 改 unknown、回调参数加 Category 类型等）
- 测试文件的 6 个 any 用 `as Partial<Transaction>[]` 等宽松方式处理
- 唯一复杂点是 BottomTabBar 的 React Navigation 类型（可能需要从 `@react-navigation/bottom-tabs` 导入 `BottomTabBarProps`）

**Warning 分布与修复策略**

| 文件 | any | unused-vars | 废弃指令 | 修复难度 |
|------|-----|-------------|----------|----------|
| `auto-guide.tsx` | 0 | 2 | 9 | EASY |
| `InsightCard.tsx` | 6 | 0 | 0 | EASY |
| `statsUtils.test.ts` | 6 | 0 | 0 | EASY（宽松） |
| `manual-entry.tsx` | 4 | 0 | 0 | EASY |
| `CategoryPicker.tsx` | 4 | 0 | 0 | EASY |
| `ManualEntryForm.tsx` | 3 | 2 | 0 | EASY |
| `login.tsx` | 1 | 0 | 0 | EASY |
| `register.tsx` | 1 | 0 | 0 | EASY |
| `_layout.tsx` | 0 | 1 | 0 | EASY |
| `AuthButton.tsx` | 0 | 1 | 0 | EASY |
| `ChatInputBar.tsx` | 0 | 1 | 0 | EASY |
| `HeaderGreeting.tsx` | 0 | 1 | 0 | EASY |
| `ProfileHeader.tsx` | 0 | 1 | 0 | EASY |
| `AccountSelectorBar.tsx` | 1 | 0 | 0 | EASY |
| `useLocalTransactions.ts` | 1 | 0 | 0 | EASY |
| `ExternalLink.tsx` | 1 | 0 | 0 | MEDIUM |
| `useChat.ts` | 1 | 0 | 0 | MEDIUM |
| `brand-detection.ts` | 1 | 0 | 0 | MEDIUM |
| `insights/types.ts` | 1 | 0 | 0 | MEDIUM |
| `sync-service.ts` | 0 | 1 | 0 | EASY |
| `BottomTabBar.tsx` | 1 | 0 | 0 | HARD |

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 类型替换引入运行时行为变化 | LOW | any→具体类型是编译期变化，不影响运行时 |
| BottomTabBar 类型不兼容 | MEDIUM | 查 @react-navigation 文档，必要时用 `unknown` + 断言过渡 |
| 删除 unused var 导致副作用遗失 | LOW | 检查删除目标是否有副作用代码 |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Quick Wins | 废弃指令清理 + unused-vars 修复（21 warnings） | in-progress | - | - | `docs/ecc/plans/lint-warning-cleanup.plan.md` |
| 2 | Type Annotations | 全部 30 个 any 替换为具体类型 | in-progress | - | 1 | `docs/ecc/plans/lint-warning-cleanup.plan.md` |
| 3 | Config Hardening | warn → error 升级 + 最终验证 | in-progress | - | 2 | `docs/ecc/plans/lint-warning-cleanup.plan.md` |

### Phase Details

**Phase 1: Quick Wins**
- **Goal**: 清除所有非 any 类型的 warning
- **Scope**:
  - `eslint --fix` 自动清除 9 个废弃 eslint-disable 指令
  - 删除 / `_` 前缀化 12 个 unused-vars（`spacing`、`guideSteps`、`isAuthenticated`、`KeyboardAvoidingView`、`Platform`、`PressableProps`、`recordingState`、`WEATHER_EMOJI`、`onSettingsPress`、`userId`）
- **Success signal**: `pnpm lint` warning 数降至 30

**Phase 2: Type Annotations**
- **Goal**: 替换全部 30 个 `any` 为具体类型
- **Scope**:
  - EASY（24 个）: catch error → `unknown`、回调参数 → `Category`、`Partial<T>` for tests
  - MEDIUM（5 个）: ExternalLink `Href`、useChat API 响应类型、brand-detection `Platform.constants`、insights meta 联合类型
  - HARD（1 个）: BottomTabBar React Navigation 类型
- **Success signal**: `pnpm lint` warning 数降至 0

**Phase 3: Config Hardening**
- **Goal**: 升级规则为 error 级别，建立质量门禁
- **Scope**:
  - `eslint.config.js` 中 `no-explicit-any`: `"warn"` → `"error"`
  - `eslint.config.js` 中 `no-unused-vars`: `["warn", ...]` → `["error", ...]`
  - 运行 `pnpm lint` 最终验证 0 error
- **Success signal**: `pnpm lint` 输出 0 problems（0 errors, 0 warnings）

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| any 替换策略 | 渐进式（精确 + unknown） | 严格全精确 / eslint-disable 逃逸 | 平衡类型安全与修复效率 |
| 测试文件 any | `Partial<T>` 宽松处理 | 完整 mock 类型 | 测试数据通常是部分结构，过度精确增加维护负担 |
| 执行方式 | 一次性全清 | 分批 PR | 51 个 warning 规模可控，一次解决避免多轮 review |
| 目标级别 | error | 保持 warn | 用户明确要求建立硬门禁 |

---

## Research Summary

**Technical Context**
- 51 个 warning 分布在 21 个文件中，70% 为简单替换
- eslint.config.js 使用 Flat Config 格式，规则修改直接改对象属性即可
- `@typescript-eslint/no-unused-vars` 已配置 `argsIgnorePattern: "^_"`，未使用参数加 `_` 前缀即可消除
- 9 个 `--fix` 可自动修复的废弃 eslint-disable 指令

---

*Generated: 2026-04-15*
*Status: DRAFT - needs validation*

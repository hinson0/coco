# 自动记账 (Auto-Bookkeeping)

## Problem Statement

用户每天有多笔微信/支付宝消费，但手动记账容易遗忘和懈怠。即便 CoCo 已有语音/小票/文字等多种记账方式，**每一笔都需要用户主动打开 App 操作**，这导致大量日常小额消费漏记，账目不完整。

## Evidence

- 用户（开发者本人）日常使用飞鸭AI 的自动记账功能，体验到"付完款自动弹出确认"的流畅度远优于手动记账
- 安卓记账市场中，钱迹、一木记账、自动记账（AutoAccounting）等 App 均以"自动记账"为核心卖点，验证了市场需求
- 当前 CoCo 的 `source` 字段已预留多种记账来源（manual/llm/ocr/asr/text），说明设计上已考虑自动化扩展

## Proposed Solution

通过 Android NotificationListenerService 监听微信支付和支付宝的支付通知，自动提取金额信息，在底部弹出确认卡片让用户一键确认入账。同时将底部导航的「收益」Tab 改造为「自动记账」指引与设置页面，引导用户开启系统通知监听权限。

## Key Hypothesis

我们相信**自动监听支付通知并弹出确认卡片**将**大幅降低记账遗忘率**，让**日常使用微信/支付宝的用户**每笔消费都能被捕获。
我们会知道方案成功，当**用户 80%+ 的日常消费通过自动记账完成，手动记账仅用于补漏**。

## What We're NOT Building

- Xposed Hook 方案 — 需要 Root，门槛太高
- AccessibilityService 无障碍方案 — Google Play 审核风险
- iOS 自动记账 — iOS 不支持通知监听，技术上无法实现
- 银行 App 通知解析 — MVP 阶段仅覆盖微信/支付宝
- 完全静默记账 — 每笔必须用户确认后才入账
- SMS 短信解析 — 权限限制越来越严格，暂不考虑

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| 自动记账记录占比 | > 50% 的日常交易来源为 `notification` | `transactions` 表 `source` 字段统计 |
| 确认率 | > 80% 的弹出确认被用户点击"确认" | 弹出次数 vs 确认次数 |
| 通知识别成功率 | > 90% 的微信/支付宝支付通知被正确解析 | 解析成功/失败日志 |

## Open Questions (Resolved)

- [x] **厂商 ROM 杀后台服务** — NLS 由系统绑定，比普通后台服务更稳定。小米/华为最激进，需引导用户设置自启动+电池优化白名单。MVP 不做保活，专注品牌适配引导页。
- [x] **通知格式差异** — 金额提取高度可靠（`/[\d]+\.?\d{0,2}\s*元/`），收支方向用关键词匹配（收款→收入，付款/消费→支出）。商户名不可靠，MVP 不依赖。无需正则版本库，一条宽泛正则足够。
- [x] **后台弹出确认 UI** — Android 10+ 限制后台启动 Activity。MVP 采用「待确认队列 + 本地通知」方案：通知到达→存入 pending 队列→发本地通知提醒→用户点通知或自然打开 App 时弹出确认卡片。不需要悬浮窗权限，后续迭代可加。
- [x] **去重策略** — 10 秒时间窗口 + 金额 + 来源（微信/支付宝）三元组去重。不用 MD5（通知文案有微小差异会导致误判）。
- [x] **AI 自动分类** — MVP 不做。通知中几乎无分类信息。默认选中用户最近使用的支出/收入分类，用户在确认卡片中手动调整。后续迭代可基于历史分类频率做本地推荐。

## Remaining Open Questions

- [ ] 各品牌手机（小米/华为/OPPO/vivo）的通知监听权限引导截图素材
- [ ] `expo prebuild` + development build 的 CI/CD 流程适配

---

## Users & Context

**Primary User**
- **Who**: 日常使用微信/支付宝付款的安卓用户（开发者本人为首要用户）
- **Current behavior**: 付款后需要手动打开 CoCo，通过语音/手动/文字方式记账，经常忘记
- **Trigger**: 完成一笔微信或支付宝付款后
- **Success state**: 付完款几秒内自动弹出确认卡片，点击确认即完成记账

**Job to Be Done**
当**我用微信/支付宝完成一笔付款**时，我想要**自动弹出记账确认**，这样我就能**不遗漏任何日常消费，保持账目完整**。

**Non-Users**
- iOS 用户（技术限制，无法实现通知监听）
- 不使用微信/支付宝的用户
- 对隐私极度敏感、不愿授予通知监听权限的用户

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Expo 原生模块：Android NotificationListenerService | 核心能力，没有它一切不成立 |
| Must | JS 通知解析引擎：微信支付 + 支付宝金额提取 | 将原始通知转为结构化交易数据 |
| Must | 底部弹出确认卡片 UI | 用户确认后才入账，核心交互 |
| Must | 「自动记账」指引页（替换收益 Tab） | 引导用户开启权限 + 显示状态 |
| Must | 隐藏广告收益功能入口 | 腾出 Tab 位，保留模块代码 |
| Must | 待确认队列 + 本地通知 | 解决后台无法直接弹 UI 的问题，保证不丢数据 |
| Must | 10s 窗口三元组去重 | 避免同笔交易重复弹出（金额+来源+时间窗口） |
| Must | 默认分类 + 用户手动选择 | 通知无分类信息，默认选最近使用的分类 |
| Should | 服务状态检测 + 品牌适配引导 | 应对厂商 ROM 杀后台，按品牌提供设置步骤 |
| Should | 通知白名单设置（选择监听哪些 App） | 减少无关通知干扰 |
| Could | AI 自动分类推测 | 后续迭代，复用后端 AI 或本地频率统计 |
| Could | 悬浮窗即时弹出 | 后续迭代，实现付款后即时弹出确认 |
| Won't | iOS 通知监听 | 技术不可行 |
| Won't | 银行 App 通知解析 | MVP 后考虑 |
| Won't | 静默自动入账（无需确认） | 准确度不够，需用户把关 |

### MVP Scope

最小可验证版本：
1. Android 原生模块能监听到微信/支付宝的支付通知
2. JS 正则能从通知文案中提取金额和收支方向
3. 解析结果存入待确认队列（SQLite），同时发本地通知提醒
4. 10 秒时间窗口 + 金额 + 来源三元组去重
5. 用户打开 App 或点击本地通知时，底部弹出确认卡片（金额 + 默认分类 + 确认按钮）
6. 确认后写入 `transactions` 表（`source: "notification"`）
7. 「自动记账」Tab 页展示权限引导 + 品牌适配设置步骤 + 开关状态

### User Flow

```
[用户完成微信/支付宝付款]
        ↓
[Android 系统推送支付通知]
        ↓
[NotificationListenerService 捕获通知]
        ↓
[JS 解析引擎提取: 金额、来源、收支方向]
        ↓
[10s 窗口去重检查] ──重复──→ [丢弃]
        ↓ (非重复)
[存入待确认队列 pending_notifications 表]
        ↓
[发送本地通知: "检测到消费 ¥25.00，点击确认记账"]
        ↓
        ├──── 用户点击本地通知 ────→ [打开 App]
        ├──── 用户自然打开 App ────→ [检测待确认队列]
        ↓
[底部弹出确认卡片]
  ┌─────────────────────────────┐
  │ 💰 检测到一笔消费              │
  │ 金额: ¥25.00                  │
  │ 来源: 微信支付                  │
  │ 分类: [上次使用的分类 ▼]       │
  │ 备注: [选填...]                │
  │                                │
  │  [忽略]          [确认记账]     │
  └─────────────────────────────┘
        ↓ (点击确认)
[写入 transactions 表, source="notification"]
        ↓
[从 pending 队列中移除]
        ↓
[在首页聊天流中生成 bill_card 消息]
```

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**

```
┌──────────────────────────────────────────────────────┐
│                      JS Layer                         │
│                                                        │
│  NotificationParser     PendingQueue    ConfirmSheet  │
│  ├─ wechat regex        ├─ SQLite 表     ├─ 底部卡片  │
│  ├─ alipay regex        ├─ 去重检查      ├─ 默认分类  │
│  ├─ 金额提取            ├─ 本地通知      ├─ 确认入账  │
│  └─ 收支方向判断        └─ App 启动检查  └─ 忽略关闭  │
│           ↑ event              ↑                      │
├──────────────────────────────────────────────────────┤
│              Expo Modules API                          │
│              (EventEmitter)                            │
├──────────────────────────────────────────────────────┤
│                  Android Native                        │
│                                                        │
│  ExpoAutoBookkeepingModule                            │
│  ├─ NotificationListenerService                       │
│  │   └─ onNotificationPosted()                        │
│  ├─ 过滤: 仅微信/支付宝包名                           │
│  ├─ 发送事件: { pkg, title, text, time }              │
│  ├─ isPermissionGranted() — 检测权限状态               │
│  └─ openPermissionSettings() — 跳转系统设置            │
│                                                        │
│  AndroidManifest.xml                                   │
│  └─ <service> + <intent-filter>                       │
└──────────────────────────────────────────────────────┘
```

**关键设计决策：**
- 原生模块命名：`expo-auto-bookkeeping`，参考已有 `expo-pangle` 的结构
- 通知数据通过 Expo EventEmitter 传递到 JS
- **待确认队列**：解析结果先存入 `pending_notifications` 表（SQLite），再发本地通知提醒用户
- **去重**：10s 时间窗口 + 金额 + 来源三元组（不用 MD5，避免通知文案微小差异导致误判）
- **默认分类**：使用用户最近一次选择的分类，而非固定的"未分类"
- **后台确认**：MVP 不需要悬浮窗权限，用户打开 App 时自动弹出待确认卡片
- JS 层使用正则解析，金额提取 `/[\d]+\.?\d{0,2}\s*元/`，收支方向用关键词匹配
- 交易写入复用现有 `useCreateTransaction()` hook
- `source` 字段新增值 `"notification"`

**通知解析规则：**

```typescript
// 金额提取（宽泛正则，覆盖微信/支付宝各版本格式）
const AMOUNT_REGEX = /([\d]+\.?\d{0,2})\s*元/;

// 收支方向判断
const INCOME_KEYWORDS = /收款|到账|转入/;
const EXPENSE_KEYWORDS = /付款|消费|支出|扣款/;

// 包名映射
const SUPPORTED_APPS = {
  'com.tencent.mm': 'wechat',           // 微信
  'com.eg.android.AlipayGphone': 'alipay', // 支付宝
};
```

**去重算法：**

```typescript
// 10 秒窗口 + 金额 + 来源三元组去重
function isDuplicate(incoming, queue): boolean {
  const WINDOW_MS = 10_000;
  return queue.some(
    existing =>
      existing.source === incoming.source &&
      existing.amount === incoming.amount &&
      Math.abs(existing.timestamp - incoming.timestamp) < WINDOW_MS
  );
}
```

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 厂商 ROM 杀后台服务 | HIGH | 不做保活，指引页按品牌提供设置教程（自启动 + 电池优化白名单）+ 服务状态检测 |
| 通知格式变化 | MEDIUM | 宽泛正则（`/[\d.]+元/`）对格式变化容错性高，无需维护版本库 |
| App 后台时无法弹 UI | RESOLVED | 待确认队列 + 本地通知，不需要悬浮窗权限 |
| 同一交易重复通知 | LOW | 10s 窗口 + 金额 + 来源三元组去重 |
| 微信扫码付不触发通知 | MEDIUM | 已知限制，无法覆盖，引导用户手动补录 |

**厂商 ROM 兼容性：**

| 厂商 | 激进程度 | 引导内容 |
|------|---------|---------|
| 小米 MIUI | 最激进 | 设置 → 应用管理 → 自启动 + 电池优化白名单 |
| 华为 HarmonyOS | 很激进 | 设置 → 电池 → 关闭"电池优化" |
| OPPO ColorOS | 激进 | 设置 → 应用管理 → 自启动管理 |
| vivo OriginOS | 中等 | 设置 → 电池 → 后台耗电限制 |
| 三星 OneUI | 较宽松 | 通常不需要额外设置 |
| 原生 Android | 宽松 | 仅需开启通知监听权限 |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently
  DEPENDS: phases that must complete first
  PRP: link to generated plan file once created
-->

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Expo 原生模块 | 创建 `expo-auto-bookkeeping` 模块，实现 NotificationListenerService | pending | - | - | - |
| 2 | JS 通知解析引擎 | 微信/支付宝通知正则解析 + 结构化输出 | pending | with 3 | 1 | - |
| 3 | 底部确认卡片 UI | 弹出确认交互组件 + 写入交易 | pending | with 2 | 1 | - |
| 4 | 自动记账指引页 | 替换「收益」Tab，权限引导 + 状态展示 | pending | with 2,3 | 1 | - |
| 5 | 隐藏广告收益 | 隐藏广告入口，保留模块代码 | pending | with 4 | - | - |
| 6 | 集成联调 | 端到端测试：付款→通知→解析→确认→入账 | pending | - | 2,3,4,5 | - |

### Phase Details

**Phase 1: Expo 原生模块**
- **Goal**: Android 端能监听到微信/支付宝的支付通知，并将数据传递到 JS
- **Scope**:
  - 创建 `modules/expo-auto-bookkeeping/` 模块（参考 expo-pangle 结构）
  - 实现 `NotificationListenerService`，过滤微信/支付宝包名
  - 通过 EventEmitter 发送 `{ packageName, title, text, timestamp }` 到 JS
  - Config plugin 自动注入 AndroidManifest 配置
  - 提供 `isPermissionGranted()` 和 `openPermissionSettings()` API
- **Success signal**: JS 层能收到微信/支付宝的支付通知事件

**Phase 2: JS 通知解析引擎 + 待确认队列**
- **Goal**: 将原始通知文案转为结构化交易数据，存入待确认队列并通知用户
- **Scope**:
  - 创建解析器：`parseNotification(pkg, title, text) → { amount, source, type } | null`
  - 宽泛金额正则：`/([\d]+\.?\d{0,2})\s*元/`（覆盖微信/支付宝各版本）
  - 收支方向：关键词匹配（收款/到账→income，付款/消费/扣款→expense）
  - 10s 时间窗口 + 金额 + 来源三元组去重
  - 创建 `pending_notifications` SQLite 表存储待确认记录
  - 解析成功后发本地通知（复用 expo-notifications）："检测到消费 ¥X.XX，点击确认记账"
- **Success signal**: 对 10+ 条真实通知文案的解析准确率 > 90%，去重正确

**Phase 3: 底部确认卡片 UI**
- **Goal**: 用户打开 App 或点击通知时，弹出底部卡片确认入账
- **Scope**:
  - App 启动/恢复时检查 `pending_notifications` 队列
  - 底部弹出组件（BottomSheet）显示：金额、来源、分类选择（默认最近使用的分类）、备注输入
  - 「确认记账」按钮 → 调用 `createTransaction(source: "notification")` + 从 pending 队列移除
  - 「忽略」按钮 → 从 pending 队列移除 + 关闭卡片
  - 多条待确认时逐条弹出
  - 确认后在聊天流中生成 `bill_card` 消息
- **Success signal**: 从通知到确认入账的完整流程可运行（包括 App 后台场景）

**Phase 4: 自动记账指引页**
- **Goal**: 替换底部导航「收益」Tab，提供清晰的功能引导
- **Scope**:
  - 页面结构：功能介绍 + 权限状态检测 + 开启引导 + 支持的 App 列表
  - Tab 标题从「💰 收益」改为「🤖 自动」
  - 权限未开启时：分步引导流程（检测手机品牌，展示对应的设置步骤）
  - 权限已开启时：运行状态 + 今日识别统计 + 待确认数量
  - 按品牌适配引导内容：小米（自启动）、华为（电池优化）、OPPO（自启动管理）等
- **Success signal**: 用户能按照引导成功开启通知监听权限

**Phase 5: 隐藏广告收益**
- **Goal**: 移除广告功能入口，保留代码模块
- **Scope**:
  - bills.tsx 完全替换为自动记账指引页
  - EntitlementGate 中「去看广告」按钮的跳转逻辑调整
  - profile.tsx 中「广告收益」入口隐藏
  - 广告模块代码（expo-pangle、rewards.ts 等）保留不删除
- **Success signal**: 用户在 App 中看不到任何广告相关入口

**Phase 6: 集成联调**
- **Goal**: 端到端验证完整流程
- **Scope**:
  - 真机测试：微信付款 → 通知捕获 → 解析 → 弹出确认 → 入账
  - 边界测试：App 在前台/后台/被杀死时的表现
  - 各品牌手机兼容性初步验证
- **Success signal**: 在开发者手机上完成 10 笔自动记账无异常

### Parallelism Notes

- Phase 2、3、4 可以在 Phase 1 完成后并行开发（它们依赖原生模块但彼此独立）
- Phase 5 不依赖其他 Phase，可随时进行
- Phase 6 必须等 2-5 全部完成后才能开始

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| 技术方案 | NotificationListenerService | AccessibilityService, Xposed, SMS | 侵入性适中，Expo 可实现，不需要 Root |
| 确认交互 | 底部弹出卡片 | 推送通知、聊天流内消息、全屏弹窗 | 参考飞鸭AI 体验，底部弹出最自然 |
| 入账方式 | 用户确认后入账 | 静默自动入账 | 通知解析准确度有限，需要用户把关 |
| 后台弹出方案 | 待确认队列 + 本地通知 | 悬浮窗（SYSTEM_ALERT_WINDOW） | 避免引导两个高权限，MVP 降低门槛；悬浮窗留作后续迭代 |
| 去重策略 | 10s 窗口 + 金额 + 来源三元组 | MD5 哈希 | 通知文案有微小差异会导致 MD5 误判，三元组更稳健 |
| 分类策略 | 默认最近使用的分类 + 手动选 | AI 自动分类 | 通知中无分类信息，AI 无输入可猜；后续迭代加本地频率推荐 |
| 保活策略 | 不保活，品牌引导 | Foreground Service 保活 | NLS 由系统绑定较稳定，保活增加复杂度且效果有限 |
| MVP 覆盖范围 | 仅微信 + 支付宝 | 加银行 App、京东等 | 覆盖 90%+ 日常消费场景，控制 MVP 范围 |
| 广告功能处理 | 隐藏入口保留代码 | 完全删除 | 以后可能恢复，保留灵活性 |
| 原生模块方式 | 自建 Expo Module | 使用第三方库 | 第三方库不成熟（1 star），自建更可控 |
| 平台支持 | 仅 Android | 加 iOS | iOS 无法监听通知，技术限制 |

---

## Research Summary

**Market Context**
- 飞鸭AI、钱迹、一木记账等主流安卓记账 App 均以自动记账为核心卖点
- AutoAccounting 开源项目（797 stars）提供了完整的技术参考（Xposed + 通知 + 无障碍 + AI）
- 通知监听是最适合非 Root 设备的方案，被大多数商业 App 采用

**Technical Context**
- CoCo 已有 Expo Native Module 开发经验（expo-pangle），可复用模式
- `transactions` 表的 `source` 字段已预留扩展（只需新增 `"notification"` 值）
- 权益系统与收益页 UI 解耦，改造收益页不影响权益功能
- 现有的 `useCreateTransaction()` hook 和 `bill_card` 消息系统可直接复用

---

*Generated: 2026-04-13*
*Updated: 2026-04-13 (resolved all 5 open questions)*
*Status: READY - all open questions resolved, ready for implementation planning*

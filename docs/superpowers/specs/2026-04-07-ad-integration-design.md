# 穿山甲广告接入设计文档

## 概述

为棉花记 App 接入穿山甲（字节跳动）广告 SDK，实现两种广告形式：**激励视频信息流**和**开屏广告**。用户通过观看广告累积权益，解锁高级功能。

## 广告平台

- **穿山甲（CSJ / Pangle）** — 字节跳动广告联盟
- **目标平台**：iOS + Android 双端
- **接入方式**：Expo Module（`expo-modules-api`）桥接原生 SDK

## 广告形式

### 1. 激励视频信息流（收益 Tab）

将底部导航的"收益" Tab（原 `bills.tsx` 账单列表）替换为广告信息流页面。

**核心交互：**
- 进入页面 → 自动加载并播放第一条激励视频
- 播放完成 → 记录观看、更新权益 → 自动预加载下一条 → 自动播放
- 用户无需操作，放下手机即可持续累积权益
- 切到其他 Tab 或点暂停 → 停止自动加载；回到收益 Tab → 恢复自动播放

**页面布局：**
- 顶部状态栏：累计观看条数、已解锁权益
- 中间：全屏激励视频广告
- 底部：下一个奖励进度条（距离解锁还需几条）、暂停按钮、查看权益入口

**错误处理：**
- 加载失败 → 等 3 秒重试
- 连续失败 3 次 → 显示"暂无广告，稍后再试"

### 2. 开屏广告

**触发时机：**
- App 冷启动
- 从后台切回前台
- 两次开屏广告之间至少间隔 30 秒（频控）

**实现位置：** `app/_layout.tsx` 根布局

**超时处理：** 最长等待 3 秒加载，超时直接进入主界面

**Pro 用户：** 跳过开屏广告

## Expo Pangle 原生模块

### 目录结构

```
modules/expo-pangle/
├── src/
│   └── ExpoPangle.ts           # JS/TS API 层
├── ios/
│   └── ExpoPangleModule.swift   # iOS 原生桥接
├── android/
│   └── ExpoPangleModule.kt      # Android 原生桥接
├── expo-module.config.json
└── plugin/
    └── withPangle.ts            # Expo config plugin
```

### JS API

```typescript
// 初始化（App 启动时调一次）
ExpoPangle.init(appId: string): Promise<void>

// 开屏广告
ExpoPangle.showSplashAd(slotId: string): Promise<{ success: boolean }>

// 激励视频
ExpoPangle.loadRewardedVideo(slotId: string): Promise<void>
ExpoPangle.showRewardedVideo(): Promise<{
  success: boolean       // 是否完整看完
  rewardVerify: boolean  // 穿山甲服务端验证通过
}>

// 事件监听
ExpoPangle.onAdLoaded(callback): void
ExpoPangle.onAdClosed(callback): void
ExpoPangle.onAdError(callback): void
```

### Config Plugin 自动配置

- **iOS：** `Info.plist`（SKAdNetwork ID、ATT 权限描述）、CocoaPods 依赖
- **Android：** `AndroidManifest.xml`（穿山甲 provider、网络权限）、Gradle 依赖

## 权益系统

### 数据库表

新增两张本地 SQLite 表：

```sql
-- 广告观看记录
ad_watch_logs (
  id            INTEGER PRIMARY KEY,
  watched_at    TEXT NOT NULL,        -- ISO 时间戳
  ad_type       TEXT NOT NULL,        -- 'rewarded_video' | 'splash'
  slot_id       TEXT,                 -- 穿山甲广告位 ID
  duration_sec  INTEGER               -- 实际观看秒数
)

-- 权益余额
entitlements (
  id            INTEGER PRIMARY KEY,
  feature       TEXT NOT NULL UNIQUE,  -- 'asr' | 'ocr' | 'multi_account' | 'csv_export'
  balance       INTEGER DEFAULT 0,     -- 剩余额度（次数/天数/周数，含义因 feature 不同）
  total_earned  INTEGER DEFAULT 0      -- 历史累计获得
)
```

### 权益分配规则

4 个功能一循环：

| 循环位置 | 功能 | 计费方式 | 1 条广告获得 |
|---------|------|---------|------------|
| 第 1 条 | 语音记账（asr） | 按次 | +1 次 |
| 第 2 条 | 小票识别（ocr） | 按次 | +1 次 |
| 第 3 条 | 多账户管理（multi_account） | 按天 | +7 天 |
| 第 4 条 | 导出 CSV（csv_export） | 按周 | +1 周 |

第 5 条起循环回第 1 条，以此类推。

### balance 字段含义

| feature | balance 含义 | 扣减时机 |
|---------|-------------|---------|
| `asr` | 剩余可用次数 | 每次使用语音记账 -1 |
| `ocr` | 剩余可用次数 | 每次使用小票识别 -1 |
| `multi_account` | 剩余天数 | 每天 0 点 -1 |
| `csv_export` | 剩余周数 | 每周一 0 点 -1 |

### 功能门控

使用高级功能时：
1. 检查用户是否为 Pro 会员 → 是则直接放行
2. 查询 `entitlements` 表对应 feature 的 balance
3. balance > 0 → 扣减并放行
4. balance <= 0 → 弹窗提示"权益不足"，提供两个入口：[去收益页看广告] [升级 Pro]

### 定时扣减

- **多账户管理：** 每天 0 点检查，balance > 0 则 -1
- **导出 CSV：** 每周一 0 点检查，balance > 0 则 -1
- 实现方式：App 启动时 + App 从后台恢复时，检查上次扣减时间，补扣过期的天/周

## 改动范围

| 模块 | 文件/目录 | 改动类型 |
|------|----------|---------|
| 原生模块 | `modules/expo-pangle/` | 新建 |
| 收益 Tab | `app/(tabs)/bills.tsx` | 整体替换为广告信息流 |
| Tab 导航 | `app/(tabs)/_layout.tsx` | Tab 配置微调 |
| 开屏广告 | `app/_layout.tsx` | 新增开屏广告逻辑 |
| 数据库 | `lib/db/schema.ts` | 新增 `ad_watch_logs` + `entitlements` 表 |
| 权益 Hook | `hooks/useEntitlement.ts` | 新建 |
| 定时扣减 | `hooks/useEntitlementDecay.ts` | 新建 |
| 功能门控 | 语音/OCR/多账户/导出入口 | 加入权益检查 |
| 广告收益说明 | `app/ad-rewards.tsx` | 更新规则（4 个一循环，新增 CSV） |

### 不改动

- `app/upgrade-pro.tsx` — Pro 会员页保持不变
- `app/(tabs)/profile.tsx` — "广告收益"入口保持不变
- `apps/backend/` — 权益全部本地管理，不涉及后端

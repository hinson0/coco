# CoCo AI (棉花记) UI 全量改版设计规格

## 1. 概述

**目标**：将 CoCo AI 移动端从当前的基础绿色/白色主题全量改版为 `ui/0316/` 设计稿中定义的"柔软有机 (Soft Organic)"风格。

**范围**：7 个页面 — 首页、AI 聊天、账单、统计、我的、登录、注册。

**实施策略**：主题系统 + 组件库先行，再逐页组装。

## 2. 设计语言

### 2.1 色彩系统

| Token | 色值 | 用途 |
|-------|------|------|
| cream | #faf6f0 | 主背景 |
| creamDark | #f0e8dc | 卡片分割线、次背景 |
| creamDeeper | #e4d8c8 | 输入框边框、深层分割 |
| sage | #7ba68a | 主强调色 — AI、收入、确认按钮 |
| sageLight | #a4ccb0 | sage 中间色 |
| sagePale | #dceee2 | sage 浅背景 |
| coral | #e8856c | 支出金额、警告、上升趋势 |
| coralLight | #f4b0a0 | coral 中间色 |
| coralPale | #fde8e2 | coral 浅背景 |
| honey | #d4a853 | 预算、PRO 标签 |
| honeyLight | #e8c87a | honey 中间色（预算进度条渐变） |
| honeyPale | #fdf4dc | honey 浅背景 |
| lavender | #9b8ec4 | 娱乐分类、日均数据 |
| lavenderPale | #ece8f4 | lavender 浅背景 |
| text | #3a3028 | 主文字 |
| textLight | #8a7e70 | 次文字 |
| textLighter | #b8aa98 | 辅助文字、占位符 |
| white | #ffffff | 卡片背景 |
| shadow | rgba(58,48,40,0.06) | 阴影基色 |

### 2.2 间距

4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32

### 2.3 圆角

| Token | 值 | 用途 |
|-------|-----|------|
| sm | 8 | badge、小按钮 |
| md | 12 | 图标容器、筛选 chip、输入框 |
| lg | 16-18 | 卡片、交易项、AI中心按钮 |
| xl | 20-22 | 大卡片、聊天输入框 |
| xxl | 24 | AI 气泡 |
| full | 9999 | 圆形按钮 |

### 2.4 字体

- 字族：PingFang SC（系统默认，iOS 自带，Android fallback 到 system sans-serif）
- 字号：9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 26
- 字重：400(regular), 500(medium), 600(semibold), 700(bold), 800(extrabold)

### 2.5 阴影

| Token | 配置 |
|-------|------|
| sm | offset: {0,1}, opacity: 0.06, radius: 4 |
| md | offset: {0,2}, opacity: 0.06, radius: 8 |
| lg | offset: {0,4}, opacity: 0.06, radius: 16 |
| xl | offset: {0,8}, opacity: 0.12, radius: 24 |

## 3. Tab 导航结构

5 个 Tab，中间 AI 按钮突出：

| 位置 | Tab | 图标 | 路由 |
|------|-----|------|------|
| 1 | 首页 | 🏡 | (tabs)/index |
| 2 | 统计 | 📊 | (tabs)/stats |
| 中 | AI 记账 | 圆角方块 + "AI" 文字 | /chat (push) |
| 4 | 账单 | 📋 | (tabs)/bills |
| 5 | 我的 | 🌿 | (tabs)/profile |

**AI 中心按钮样式**：
- 56x56, borderRadius: 18
- 背景：`linear-gradient(145deg, #5a9468 0%, #7ba68a 50%, #8fc4a0 100%)`
- 阴影：`0 4px 16px rgba(123,166,138,0.35)` + 外环 `0 0 0 3px rgba(123,166,138,0.1)`
- marginTop: -18（突出 tab bar）
- 内含 SVG："AI" 白色文字 + ✦ 金色星标

**移除预算独立 Tab**：预算功能入口移至首页 OverviewCard + 我的页面菜单。

## 4. 组件库设计

### 4.1 基础组件

| 组件 | Props | 说明 |
|------|-------|------|
| AppText | size, weight, color, children | 统一字体/颜色的文字组件 |
| Card | radius?, shadow?, padding?, style?, children | 白色圆角卡片容器 |
| Chip | label, icon?, active?, onPress | 圆角标签按钮 |
| IconBox | emoji, color (coral/sage/honey/lavender) | emoji 图标容器，彩色背景方块 |
| Badge | text, variant (ai/new/pro) | 小标签 |

### 4.2 复合组件

| 组件 | Props | 说明 |
|------|-------|------|
| TransactionItem | transaction, onPress? | 交易记录行。尺寸规范：容器 radius 18, emoji 容器 40x40 radius 14, 金额 14px bold。支出金额使用 text 色（非 coral），收入金额使用 sage 色。AI 标签使用 Badge(ai) 组件：sage bg, 8px, radius 4, padding 2px 6px |
| DayGroup | date, total, transactions | 按日分组的交易列表 |
| OverviewCard | stats (支出/收入/结余/预算/剩余/日均), subs? (各格位可选副标签如"较上月 +12%") | 6 格概览 + 预算进度条。副标签为 9px textLighter，显示在数值下方，数据由 API 提供，可选 |
| BottomTabBar | — | 自定义底部导航含 AI 中心按钮 |
| ChatBubble | message (role, content_type, content) | 聊天气泡（多变体） |
| RecordCard | transaction, status, onConfirm?, onEdit?, variant? | 记账确认卡片。cream 背景 radius 14。字段根据来源变化：文字/语音 → 金额+分类+备注；OCR → 金额+分类+商户+明细。底部按钮行：主按钮"确认记录"(sage, flex:1) + 次按钮"修改"(creamDark bg)。status="done" 时隐藏按钮显示"已记录" badge |
| VoiceBubble | duration, isPlaying, onPlay, transcription? | 语音消息气泡。波形 3 条柱 + 时长文字。用户侧 sage 背景，AI 侧白色背景。可选 transcription 属性在气泡下方显示转写文字（12px textLighter，前缀"[转文字]" sage 色 10px） |
| MenuItem | icon, iconBg, title, desc?, badge?, onPress | 设置菜单行 |
| SuggestionChip | label, onPress | AI 消息内联建议按钮 |

### 4.3 页面级组件

**首页**：HeaderGreeting, AiBubbleEntry

**AI 聊天**：ChatToolBar, ChatInputBar, OcrBubble, TypingIndicator

**账单**：FilterBar, MonthStrip

**统计**：PeriodTabs, MonthSelector, TrendInsightRow, BarChartCard (gifted-charts), DonutChartCard (gifted-charts)

**我的**：ProfileHeader, StatsStrip, AiAssistantCard

**Auth**：AuthInput, AuthButton

## 5. 页面设计详情

### 5.1 首页

**结构**（从上到下）：
1. StatusBar（sticky, cream 背景）
2. HeaderGreeting — 左侧日期小字（中文格式如"三月十六日 周一 ☀️", 13px textLighter）+ "棉花记"大标题 26px bold，右侧 🌿 头像 44x44 radius 16
3. AiBubbleEntry — sage-pale 渐变背景, radius 24, 点击跳转 /chat
   - AI 头像 34x34 + "棉花助手" 标题(13px bold sage) + 副标题"随时帮你记一笔~"(11px textLighter) + 假输入区域（半透明白色 rgba(255,255,255,0.7) radius 16, typing dots 动画 + "说说你花了什么..." 占位文字）
4. OverviewCard — 白色卡片 radius 22
   - 上排 3 格 grid：支出(coral) / 收入(sage) / 结余(text)
   - 分割线
   - 下排 3 格：本月预算(honey) / 月剩余(sage) / 剩余日均(lavender)
   - 底部预算进度条（honey-light → coral-light 渐变）
5. 交易列表 — DayGroup 组件，按日分组

**数据来源**：stats API + budgets API + transactions API

### 5.2 AI 聊天

**结构**：
1. 顶部导航 — [←] 返回白色圆角按钮 + 🟢 "棉花助手" 标题（绿点呼吸动画）+ [···] 操作按钮
2. 聊天区域 — FlatList 倒序渲染
   - 日期分割线（居中, 11px, textLighter）
   - AI 气泡：白色背景, 左上小圆角(6px), 其余 18px, 左上角 avatar 28x28
   - 用户气泡：sage 背景白色文字, 右上小圆角(6px), 右对齐
   - RecordCard：嵌在 AI 气泡中, cream 背景 radius 14
   - VoiceBubble：波形动画 + 时长, sage(用户)/白(AI)
   - OcrBubble：小票图片占位 + "📸 小票识别" sage 标签
   - SuggestionChip：sage-pale 背景, hover 变 sage
   - TypingIndicator：三个 sage 圆点上下跳动
3. ChatToolBar — 横向滚动 Chip（⚡快速记账, 📸拍小票, 📊月度报告, 📋记账模板, 🔄重复记）
4. ChatInputBar — [📷] + 输入框(cream bg, radius 22) + [🎤](cream 圆形) + [+](sage 圆形)

**话题建议**：不在底部面板显示（与设计稿 mockup 的底部话题区有意不同），而是作为 SuggestionChip 嵌入 AI 消息气泡中上下文推送。这样聊天区域更大，体验更清爽。

**底部面板容器**：ChatToolBar + ChatInputBar 包裹在一个白色背景容器中，顶部有 1px creamDark 分割线。

**OcrBubble**：属于用户侧消息，右对齐，右上小圆角 6px。包含小票图片占位（cream 渐变背景 + 🧾 emoji + 模拟文字行 + 金额）+ 底部 sage 标签"📸 小票识别"。

**TypingIndicator**：包含独立的 AI 头像（28x28 sage 背景 🤖）+ 白色气泡内三个 sage 圆点。

**ChatInputBar**：placeholder 文字为"记一笔或按住说话..."。

**交互**：
- 文字：直接输入发送 → 文字/查询通道
- 语音：长按 🎤 录音，松手发送 → ASR 通道
- 拍照：点击 📷 拍照发送 → OCR 通道
- RecordCard "确认记录"/"修改" 按钮处理用户反馈

### 5.3 账单页

**结构**：
1. Header — "账单" 大标题 22px + 🔍 搜索按钮（白色圆角 36x36）
2. FilterBar — 横向 Chip 列表（全部/餐饮/交通/购物/娱乐/收入），active 为 sage
3. MonthStrip — 白色卡片：月份 + 笔数 badge + 总金额(coral)
4. DayGroup 列表 — 复用首页的 DayGroup + TransactionItem 组件

**筛选逻辑**：active chip 切换 → 重新调用 transactions API 带 category 参数。

### 5.4 统计页

**结构**：
1. Header — "统计" 大标题 + PeriodTabs（周/月/年，白色背景 pill, sage active）
2. MonthSelector — ‹ / 2026年3月 / ›
3. 收支结余三卡 — 3 个白色小卡片横排
4. BarChartCard — "每周对比" 柱状图（react-native-gifted-charts）
   - coral-light 柱 = 支出, sage-light 柱 = 收入
   - 圆角柱顶, 带入场动画
5. DonutChartCard — "支出分类" 环形图 + 右侧分类列表
   - 中心显示总支出金额
   - 右侧列表：emoji + 分类名 + 百分比 + 金额
6. TrendInsightRow — "AI 洞察" 列表
   - 每行：emoji + 标题/描述 + 趋势 badge（coral=上升, sage=下降）

**图表库**：react-native-gifted-charts

### 5.5 我的页面

**结构**：
1. ProfileHeader — 右上角 ⚙️ 设置按钮（白色圆角 36x36 radius 12）+ 居中头像 🌿 72x72 radius 24（渐变背景 sage-pale → coral-pale）+ 名称 20px bold + "已记账 128 天" 12px textLighter
2. StatsStrip — 白色卡片 3 列：本月笔数 / 连续记账 / 预算达标月
3. AiAssistantCard — sage-pale 渐变背景, 🤖 头像 + "棉花助手" + 描述 + ›
4. MenuSection × 3：
   - 资产管理：💳 我的账户 / 🎯 预算设置 / 🏷️ 分类管理
   - 工具：📸 小票识别(NEW) / 📤 导出报表 / 🔔 记账提醒
   - 其他：🌟 升级Pro(PRO) / 💬 意见反馈 / ℹ️ 关于棉花记

### 5.6 登录/注册页

**风格延伸**（设计稿中无此页面，基于柔软有机风格设计）：

- cream 全屏背景
- 居中 🌿 logo 72px + "棉花记" 标题 + "AI 智能记账助手" 副标题
- 白色卡片表单：
  - AuthInput：cream 底色 + creamDeeper 边框, radius 12, 聚焦时 sageLight 边框
  - AuthButton：sage 背景 + 白色文字, radius 12
  - 切换链接：sage 色文字

## 6. 关键交互 & 动画

| 元素 | 动画 |
|------|------|
| 页面进入 | floatIn — opacity 0→1 + translateY 20→0 + scale 0.97→1, 各元素延迟 0.1s 错开 |
| AI 头像 | gentle-bounce — translateY 0 → -3px → 0, 3s 循环 |
| 绿点状态 | pulse — opacity 1 → 0.4 → 1, 2s 循环 |
| Typing dots | 三个圆点交错上下弹跳, 1.2s 循环 |
| 预算进度条 | fillBudget — width 0% → 目标%, 1s ease-out |
| 消息入场 | msgIn — opacity 0→1 + translateY 10→0, 0.4s |
| 语音波形 | wave-play — height 4px → 18px → 4px, 3 条交错 |
| Tab 项交互 | 非活跃 opacity 0.35, 活跃 opacity 1 |
| TransactionItem | hover/press translateX 3-4px |
| AI 中心按钮 | press scale 0.92, release 恢复 |

## 7. 文件结构变更

```
apps/mobile/
├── constants/
│   └── theme.ts                    ← 新增：主题常量
├── components/
│   ├── ui/                         ← 新增：基础组件
│   │   ├── AppText.tsx
│   │   ├── Card.tsx
│   │   ├── Chip.tsx
│   │   ├── IconBox.tsx
│   │   └── Badge.tsx
│   ├── shared/                     ← 新增：复合共享组件
│   │   ├── TransactionItem.tsx
│   │   ├── DayGroup.tsx
│   │   ├── OverviewCard.tsx
│   │   ├── BottomTabBar.tsx
│   │   └── MenuItem.tsx
│   ├── home/                       ← 重写
│   │   ├── HeaderGreeting.tsx
│   │   ├── AiBubbleEntry.tsx
│   │   ├── DailySummary.tsx        ← 删除（被 OverviewCard 替代）
│   │   └── TransactionList.tsx     ← 删除（被 DayGroup 替代）
│   ├── chat/                       ← 重写
│   │   ├── ChatBubble.tsx
│   │   ├── RecordCard.tsx
│   │   ├── VoiceBubble.tsx
│   │   ├── OcrBubble.tsx
│   │   ├── SuggestionChip.tsx
│   │   ├── TypingIndicator.tsx
│   │   ├── ChatToolBar.tsx
│   │   ├── ChatInputBar.tsx
│   │   ├── BillCard.tsx            ← 删除（被 RecordCard 替代）
│   │   ├── ChatInput.tsx           ← 删除（被 ChatInputBar 替代）
│   │   ├── ChatMessage.tsx         ← 删除（被 ChatBubble 替代）
│   │   └── VoiceRecorder.tsx       ← 删除（被 VoiceBubble 替代）
│   ├── bills/                      ← 新增
│   │   ├── FilterBar.tsx
│   │   └── MonthStrip.tsx
│   ├── stats/                      ← 新增
│   │   ├── PeriodTabs.tsx
│   │   ├── MonthSelector.tsx
│   │   ├── BarChartCard.tsx
│   │   ├── DonutChartCard.tsx
│   │   └── TrendInsightRow.tsx
│   ├── profile/                    ← 新增
│   │   ├── ProfileHeader.tsx
│   │   ├── StatsStrip.tsx
│   │   └── AiAssistantCard.tsx
│   └── auth/                       ← 新增
│       ├── AuthInput.tsx
│       └── AuthButton.tsx
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx             ← 重写：新 Tab 结构 + BottomTabBar
│   │   ├── index.tsx               ← 重写：首页
│   │   ├── stats.tsx               ← 重写：统计
│   │   ├── bills.tsx               ← 新增：账单（替代 budget.tsx）
│   │   ├── profile.tsx             ← 重写：我的
│   │   ├── budget.tsx              ← 删除
│   │   └── ai-placeholder.tsx      ← 删除
│   ├── chat.tsx                    ← 重写：AI 聊天
│   └── (auth)/
│       ├── login.tsx               ← 重写
│       └── register.tsx            ← 重写
```

### 7.1 需删除的旧文件

| 文件 | 原因 |
|------|------|
| constants/Colors.ts | 被 theme.ts 替代 |
| components/home/DailySummary.tsx | 被 OverviewCard 替代 |
| components/home/TransactionList.tsx | 被 DayGroup 替代 |
| components/chat/BillCard.tsx | 被 RecordCard 替代 |
| components/chat/ChatInput.tsx | 被 ChatInputBar 替代 |
| components/chat/ChatMessage.tsx | 被 ChatBubble 替代 |
| components/chat/VoiceRecorder.tsx | 被 VoiceBubble 替代 |
| components/EditScreenInfo.tsx | Expo 脚手架遗留，不再使用 |
| components/StyledText.tsx | 被 AppText 替代 |
| components/Themed.tsx | 被 theme.ts + 新组件体系替代 |
| components/useClientOnlyValue.ts / .web.ts | 不再需要 |
| components/useColorScheme.ts / .web.ts | 新设计不使用 dark mode |
| app/(tabs)/budget.tsx | Tab 结构变更，预算入口移至首页和我的 |
| app/(tabs)/ai-placeholder.tsx | 被 AI 中心按钮直接 push /chat 替代 |

### 7.2 保留但不改动的文件

| 文件 | 说明 |
|------|------|
| components/CategoryPicker.tsx | 手动记账表单仍需使用 |
| components/ManualEntryForm.tsx | 手动记账表单仍需使用，样式后续随 chat 页迭代 |
| components/ExternalLink.tsx | 通用工具组件，保留 |
| app/modal.tsx | 保留，样式可后续更新 |
| app/+not-found.tsx | 保留，样式可后续更新 |
| app/+html.tsx | Expo web 入口，保留 |

## 8. 新增依赖

| 包 | 用途 |
|------|------|
| react-native-gifted-charts | 柱状图 + 环形饼图 |
| react-native-svg | gifted-charts 依赖 + AI 按钮 SVG 内容（当前 package.json 中未直接声明，需显式安装） |

## 9. 不变的部分

以下模块保持不变，只替换 UI 层：

- **数据层**：hooks/ 下的 useTransactions, useBudgets, useCategories, useChat, useAuth
- **状态管理**：store/chatStore.ts (Zustand)
- **API 客户端**：lib/api.ts, lib/supabase.ts
- **BFF**：apps/api/ 整个目录不动
- **共享包**：packages/shared/, packages/ai/
- **Supabase**：migrations, config 不动

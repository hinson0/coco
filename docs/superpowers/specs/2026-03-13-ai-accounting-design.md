# CoCo AI 记账 App — 设计规格文档

## 1. 概述

**产品名称**：CoCo AI
**定位**：面向个人用户的 AI 智能记账 App
**核心理念**：一个聊天窗口 = 所有记账入口。语音、拍照、文字输入统一融合在 AI 对话界面中，用户无需理解"手动/OCR/ASR"的区别。

### 核心功能

| 功能 | 说明 |
|------|------|
| 手动记账 | 传统表单输入（金额、分类、备注、日期） |
| OCR 拍照识票 | 拍小票/发票，AI 自动生成账单 |
| ASR 语音记账 | 说一句话，AI 自动解析生成账单 |
| AI 智能分类 | 自动识别消费类别（餐饮、交通等） |
| 收支统计图表 | 月报/周报、分类饼图、趋势折线图 |
| 自然语言查询 | 输入"上周花了多少钱吃饭"直接查账 |
| 预算管理 | 设定预算、超支提醒 |

## 2. 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 客户端 | React Native (Expo) | 跨平台移动端，支持 iOS / Android |
| BFF | Next.js API Routes | 部署在 Vercel，负责 AI 编排和第三方 API 聚合 |
| 数据库 | Supabase (PostgreSQL) | 数据存储 + Auth + Storage + RLS |
| LLM | 智谱 AI (GLM) 免费模型 | 智能分类、文本解析、NL 查询、结果汇总 |
| ASR | 腾讯云语音识别 | 语音 → 文字 |
| OCR | 腾讯云票据 OCR | 票据/发票识别 |
| 状态管理 | Zustand | 轻量客户端状态 |
| 数据请求 | React Query (TanStack Query) | 服务端数据缓存与同步 |
| Monorepo | Turborepo | 管理多包结构 |

## 3. 系统架构

```
┌─────────────────────┐
│  📱 客户端 (Expo)     │
│  - 聊天 AI 记账页     │
│  - 首页 / 统计 / 预算  │
│  - Zustand + React Query │
└──────────┬──────────┘
           │ HTTPS (JWT)
┌──────────▼──────────┐
│  ⚡ BFF (Next.js)    │
│  - /api/record/*     │
│  - /api/query/nl     │
│  - /api/stats        │
│  - AI 编排层          │
└──┬───────┬───────┬──┘
   │       │       │
┌──▼──┐ ┌─▼──┐ ┌─▼──────┐
│Supa │ │GLM │ │腾讯云    │
│base │ │API │ │ASR/OCR  │
└─────┘ └────┘ └────────┘
```

**关键安全设计**：
- 腾讯云、GLM 的 API Key 全部在 BFF 端，客户端零暴露
- Supabase Auth 提供 JWT，BFF 验证 Token 后才处理请求
- Supabase RLS 全表启用，数据库层强制用户数据隔离

**认证流程**：客户端直接使用 Supabase Auth SDK 完成注册/登录/刷新 Token（不经过 BFF），BFF 只负责验证客户端传来的 JWT。

**时区处理**：客户端在每次请求 Header 中携带 `X-Timezone`（如 `Asia/Shanghai`），BFF 使用该时区解析 GLM 返回的相对日期（如"昨天""上周"），转为 UTC 后存储。

**ASR 音频格式**：Expo AV 录音使用 WAV 格式（16kHz 采样率、单声道），与腾讯云 ASR 实时语音识别 API 要求对齐。

## 4. 数据模型

### 4.1 users（Supabase Auth 自动管理）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | Supabase Auth 自动生成 |
| email | text | 用户邮箱 |
| created_at | timestamptz | 注册时间 |

### 4.2 categories（消费分类）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK → users.id \| null | null 表示系统预置分类，所有用户可见 |
| name | text | 分类名（餐饮、交通…） |
| icon | text | emoji 图标 |
| type | enum(income, expense) | 收入/支出 |
| is_default | boolean | 是否系统预置 |

**RLS 策略**：`user_id IS NULL OR user_id = auth.uid()`，系统预置分类对所有用户可见，自定义分类仅本人可见。

### 4.3 transactions（账单记录 — 核心表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK → users.id | |
| category_id | uuid FK → categories.id | |
| amount | numeric(12,2) | 金额 |
| type | enum(income, expense) | 收入/支出 |
| note | text | 备注 |
| occurred_at | timestamptz | 消费时间（客户端传入用户时区，BFF 转为 UTC 存储） |
| source | enum(manual, ocr, asr, text) | 录入来源 |
| raw_input | text | 原始语音/OCR/文字内容 |
| receipt_url | text | 票据图片 URL（Supabase Storage） |
| ai_confidence | float | AI 识别置信度 |
| created_at | timestamptz | 创建时间 |
| deleted_at | timestamptz \| null | 软删除时间，null 表示未删除 |

**设计说明**：
- `source` 记录每笔账单的录入方式，便于统计 AI 功能使用率
- `raw_input` 保留原始输入，供用户对照核查
- `ai_confidence` 低于阈值（0.7）时前端账单卡片加 ⚠️ 标记（仍写入 DB，用户可事后编辑/删除）
- `deleted_at` 支持软删除，用户误删可恢复

### 4.4 budgets（预算）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK → users.id | |
| category_id | uuid FK → categories.id \| null | null 表示总预算 |
| amount | numeric(12,2) | 预算金额 |
| period | enum(weekly, monthly, yearly) | 预算周期 |
| start_date | date | 生效日期 |

### 4.5 chat_messages（聊天消息）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK → users.id | |
| role | enum(user, assistant) | 发送方 |
| content_type | enum(text, audio, image, bill_card, nl_result) | 消息类型 |
| content | text | 文本内容 / JSON 数据 |
| transaction_id | uuid FK → transactions.id \| null | 关联的账单（bill_card 类型） |
| created_at | timestamptz | |

**设计说明**：聊天记录独立存储，不依赖 `transactions` 表重建。`bill_card` 类型消息通过 `transaction_id` 关联实际账单。

### 4.6 nl_query_logs（自然语言查询日志）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK → users.id | |
| question | text | 用户问题原文 |
| generated_sql | text | GLM 生成的 SQL |
| result_summary | text | 汇总结果 |
| created_at | timestamptz | |

## 5. AI Pipeline

### 5.1 OCR 通道（拍照识票）

```
① 用户拍照 (Expo Camera)
→ ② 上传图片 (Base64 → BFF)
→ ③ 腾讯云 OCR (票据/发票识别)
→ ④ GLM 提取 (金额/商户/日期/分类)
→ ⑤ 直接生成账单，自动写入 DB
```

**GLM Prompt**：
```
从以下 OCR 文本中提取：金额、消费类别、商户名称、消费时间。以 JSON 格式返回。
OCR文本：{ocr_text}
```

### 5.2 ASR 通道（语音记账）

```
① 用户长按录音 (Expo AV)
→ ② 上传音频 (WAV → BFF)
→ ③ 腾讯云 ASR (语音 → 文字)
→ ④ GLM 解析 (提取记账信息)
→ ⑤ 直接生成账单，自动写入 DB
```

**GLM Prompt**：
```
从以下语音转文字内容中提取记账信息，返回 JSON：{amount, category, note, occurred_at}。
当前时间：{now}。内容：{asr_text}
```

### 5.3 文字通道（打字记账）

```
① 用户输入文字 (如"午饭 35")
→ ② GLM 意图分类 (record / query)
→ ③a 记账意图 → GLM 提取记账信息 → 生成账单
→ ③b 查询意图 → 转入 NL 查询通道 (5.4)
```

**意图分类 GLM Prompt**：
```
判断以下用户输入的意图，返回 JSON：{"intent": "record"} 或 {"intent": "query"}。
- record：用户在描述一笔消费或收入（如"午饭35"、"打车花了20"）
- query：用户在查询历史数据（如"上周花了多少"、"本月餐饮支出"）
用户输入：{user_text}
```

### 5.4 自然语言查询通道

```
① 用户输入 (如"上周吃饭多少钱")
→ ② GLM Text2SQL (生成 SQL)
→ ③ BFF 安全校验 (只允许 SELECT)
→ ④ Supabase 执行查询
→ ⑤ GLM 汇总 (生成自然语言答复)
```

**安全要点**：
- BFF 对 GLM 生成的 SQL 做白名单校验：只允许 `SELECT`，禁止 `DROP/UPDATE/INSERT/DELETE`
- **表白名单**：只允许查询 `transactions` 和 `categories` 两张表，禁止访问 `nl_query_logs`、`budgets` 等
- **函数黑名单**：禁止 `pg_read_file`、`dblink`、`copy`、`lo_import` 等 PostgreSQL 危险函数
- 用户的 `user_id` 由服务端强制注入到 WHERE 条件，不依赖 GLM 生成
- SQL 正则校验失败时返回"无法理解，请换个问法"

### 5.5 统一降级策略

- 腾讯云 OCR 超时/失败 → 提示用户手动输入，不阻塞流程
- GLM 解析失败 → 提示识别失败，引导用户手动记账
- NL 查询 SQL 校验不通过 → 返回"无法理解，请换个问法"
- 所有 AI 调用设置 **8s 超时**，前端展示 loading 状态

## 6. UI 设计

### 6.1 Tab Bar 结构（5 个 Tab）

| Tab | 图标 | 说明 |
|-----|------|------|
| 首页 | 🏠 | 今日收支概览 + 最近账单列表 + NL 搜索框 |
| 统计 | 📊 | 月报/周报 + 分类饼图 + 趋势折线图 |
| **✦ AI 记账** | 菱形 Spark | **中间突出按钮**，旋转 45° 圆角方块 + 橙色渐变 |
| 预算 | 🎯 | 总预算 + 分类预算 + 超支提醒 |
| 我的 | 👤 | 账号设置 + 分类管理 + 数据导出（CSV，按时间范围筛选，分享/下载） |

**中间按钮设计**：菱形 Spark 造型（旋转 45° 圆角方块），橙色渐变背景 + ✦ 星标 + "AI" 文字，突出 AI 概念。

### 6.2 AI 聊天页（核心页面）

点击中间 ✦ AI 按钮 → **直接进入 AI 对话页面**（无 Action Sheet 中间步骤）。

**页面结构**：
- **顶部导航**：返回 + "✦ CoCo AI" 标题 + 设置按钮
- **聊天区域**：对话气泡 + 账单卡片流
- **快捷操作栏**：横向滚动的 Chip 按钮（手动记账、问一问）
- **底部输入栏**：📷 相机按钮 | 文字输入框 | 🎙️ 麦克风按钮

**输入方式融合**：
- **🎙️ 语音**：长按右侧麦克风按钮，松手发送 → ASR → GLM → 账单卡片
- **📷 拍照**：点击左侧相机按钮，拍照发送 → OCR → GLM → 账单卡片
- **⌨️ 文字**：直接打字"午饭 35" → GLM 解析 → 账单卡片
- **💬 查询**：输入"这周花了多少" → NL Query → 文字答复

**账单卡片设计**：
- AI 识别后**无论置信度高低都直接写入 DB**，聊天中展示已生成的账单卡片
- 卡片包含：分类 emoji + 分类名 + 备注 + 金额 + 日期
- 卡片内嵌「编辑」和「删除」操作
- 支出：红色左边框；收入：绿色左边框
- 低置信度（< 0.7）时卡片加 ⚠️ 标记
- 聊天历史 = 记账流水，翻聊天即可回顾消费

**手动记账**：
- 点击快捷栏"手动记账" → 弹出传统表单（金额键盘 + 分类选择 + 备注 + 日期）

## 7. API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/record/manual | 手动记账 |
| POST | /api/record/ocr | 拍照识票（接收 Base64 图片） |
| POST | /api/record/asr | 语音记账（接收音频文件） |
| POST | /api/record/text | 文字记账（接收自然语言文本） |
| POST | /api/query/nl | 自然语言查询 |
| GET | /api/stats | 统计聚合（支持 period/category 参数） |
| GET | /api/budgets | 获取预算列表 |
| POST | /api/budgets | 创建/更新预算 |
| GET | /api/transactions | 获取账单列表（分页） |
| PATCH | /api/transactions/:id | 编辑账单 |
| DELETE | /api/transactions/:id | 删除账单（软删除） |
| GET | /api/categories | 获取分类列表（含系统预置 + 自定义） |
| POST | /api/categories | 创建自定义分类 |
| PATCH | /api/categories/:id | 编辑自定义分类 |
| DELETE | /api/categories/:id | 删除自定义分类 |
| GET | /api/chat/messages | 获取聊天历史（分页） |
| GET | /api/export | 导出账单 CSV（支持 start_date/end_date 参数） |

## 8. 项目结构

```
coco/
├── apps/
│   ├── mobile/          # Expo React Native App
│   └── api/             # Next.js BFF (Vercel)
├── packages/
│   ├── shared/          # 共享类型、工具函数、常量
│   └── ai/              # AI 服务封装（GLM、腾讯云）
├── supabase/            # Migrations, RLS 策略, Seed 数据
├── turbo.json
└── package.json
```

## 9. 测试策略

| 类型 | 工具 | 覆盖范围 |
|------|------|---------|
| 单元测试 | Vitest | GLM Prompt 构建、金额/日期解析、SQL 白名单校验、预算计算（覆盖率 80%+） |
| 集成测试 | Vitest + Supabase Local | BFF API 端到端、RLS 权限验证、AI 服务 Mock 降级、Auth 认证流程 |
| E2E 测试 | Maestro | 手动记账完整流程、登录 → 记账 → 查看统计、预算设置 → 超支提醒 |

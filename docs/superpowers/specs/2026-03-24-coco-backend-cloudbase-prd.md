# CoCo AI 记账 — 后端接入 PRD
**日期**：2026-03-24
**状态**：待实施
**范围**：后端 BFF 设计 + 全面迁移至腾讯云 CloudBase

---

## 一、产品背景与目标

**产品**：CoCo — AI 驱动的个人记账 App，以聊天窗口为统一入口，支持语音、拍照、文字三种输入方式。

**核心理念**：离线优先——用户无网络时也能正常记账，联网后自动同步。

### 两阶段计划

| 阶段 | 目标 | 状态 |
|------|------|------|
| **Phase 1 — 离线完善** | 完成全离线功能，本地 SQLite 存储，本地规则引擎，完整账单 UI | 进行中 |
| **Phase 2 — 后端接入** | 删除所有 Supabase 代码，全面迁入腾讯云 CloudBase，接通 AI 服务 | 待启动 |

---

## 二、Phase 1 完成标准（进入 Phase 2 的前提）

在开始任何后端工作之前，以下功能必须全部稳定：

- [ ] 文字记账：输入 → 本地 rule-engine 解析 → SQLite 存储
- [ ] 语音记账：本地录音、本地播放（ASR 解析留给 Phase 2）
- [ ] 拍照记账：本地拍照展示（OCR 解析留给 Phase 2）
- [ ] 账单列表：增删改查、分类筛选、日期分组
- [ ] 统计图表：月度支出/收入、分类占比
- [ ] 预算管理：设置与提醒
- [ ] 数据持久化：App 重启后数据不丢失

---

## 三、整体技术架构（Phase 2）

```
┌─────────────────────────────────────┐
│         React Native (Expo)          │
│  CloudBase JS SDK（替换 Supabase）   │
└──────────────┬──────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────┐
│      腾讯云 CloudBase               │
│  ┌──────────┐  ┌─────────────────┐  │
│  │  Auth    │  │  MySQL 数据库   │  │
│  │ 手机号/  │  │  （账单/分类/   │  │
│  │ 微信登录 │  │   预算/用户）   │  │
│  └──────────┘  └─────────────────┘  │
│  ┌──────────────────────────────┐   │
│  │      Python 云函数           │   │
│  │  record-asr / record-ocr     │   │
│  │  bill-parse / chat (流式)    │   │
│  └──────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         腾讯云 AI 服务              │
│  ASR（语音识别）  OCR（文字识别）   │
│  智谱 GLM（记账解析 + 对话查询）    │
└─────────────────────────────────────┘
```

---

## 四、AI 处理流程

### 所有输入的统一流程

```
文字输入   ──────────────────────────────────┐
语音输入 → [CloudBase: ASR] → 文字            ├→ rule-engine → 命中 → 直接记账
拍照输入 → [CloudBase: OCR] → 文字            │               没命中 → [CloudBase: bill-parse GLM] → 记账
                                             ┘
```

### 对话查询流程

```
用户问"我这个月消费情况"
  → 本地读取账单数据
  → 发送给 [CloudBase: chat 云函数]
  → GLM 流式分析
  → App 流式展示回复
```

---

## 五、云函数设计

### 5.1 `record-asr` — 语音识别

| 项目 | 内容 |
|------|------|
| 方法 | POST |
| 输入 | `{ audioBase64: string }` |
| 输出 | `{ text: string }` |
| 实现 | 腾讯云 ASR Python SDK，`VoiceFormat: "m4a"`，`EngSerViceType: "16k_zh"` |
| 错误处理 | ASR 失败返回 `{ error: "语音识别失败，请重试" }` |

### 5.2 `record-ocr` — 图片识别

| 项目 | 内容 |
|------|------|
| 方法 | POST |
| 输入 | `{ imageBase64: string }` |
| 输出 | `{ text: string }` |
| 实现 | 腾讯云 OCR（通用印刷体识别）Python SDK |
| 错误处理 | OCR 失败返回原始图片提示 |

### 5.3 `bill-parse` — 账单解析（GLM）

| 项目 | 内容 |
|------|------|
| 触发时机 | 本地 rule-engine 没有匹配上时调用 |
| 方法 | POST |
| 输入 | `{ text: string, categories: string[] }` |
| 输出 | `{ amount: number, type: "expense"\|"income", categoryName: string, note: string }` |
| 实现 | 智谱 GLM，结构化输出，带用户分类列表作 context |

### 5.4 `chat` — 对话查询（流式）

| 项目 | 内容 |
|------|------|
| 方法 | POST + SSE 流式响应 |
| 输入 | `{ message: string, transactions: Transaction[] }` |
| 输出 | Server-Sent Events 流式文字 |
| 实现 | 智谱 GLM 流式 API，带账单数据作上下文 |
| 安全 | API Key 仅存于云函数环境变量，前端不可见 |

---

## 六、数据同步设计

### 离线 → 在线同步流程

```
用户操作（离线）
  → 写入本地 SQLite
  → 加入 Operation Queue（已实现）
  → 网络恢复
  → SyncManager 批量上传
  → CloudBase MySQL
```

### 冲突策略

- **以本地为主**：离线期间的操作不会被服务端覆盖
- **幂等操作**：每条记录有本地生成的 UUID，重复上传安全
- **同步失败**：失败的操作留在队列，下次联网重试

---

## 七、认证设计

| 方式 | 说明 |
|------|------|
| 手机号 + 验证码 | 主要登录方式 |
| 微信一键登录 | 可选，CloudBase 原生支持 |
| Token 管理 | CloudBase JS SDK 自动处理 refresh |

---

## 八、Supabase → CloudBase 迁移计划

迁移在 Phase 1 完成后进行，按以下顺序执行：

| 步骤 | 内容 | 涉及文件 |
|------|------|---------|
| 1 | 安装 CloudBase JS SDK，删除 Supabase 包 | `package.json` |
| 2 | 重写 `lib/supabase.ts` → `lib/cloudbase.ts` | `apps/mobile/lib/` |
| 3 | 重写 Auth hooks（登录/注册/登出） | `hooks/useAuth.ts` |
| 4 | 迁移数据库 schema 到 CloudBase MySQL | `supabase/` 目录删除 |
| 5 | 更新 SyncManager 目标为 CloudBase DB | `lib/queue/` |
| 6 | 替换所有 `apiFetch` 调用为 CloudBase 云函数调用 | `hooks/useChat.ts` 等 |
| 7 | 环境变量替换 `SUPABASE_*` → `CLOUDBASE_*` | `.env` 文件 |
| 8 | 删除 `supabase/` 目录 | — |

---

## 九、环境变量（Phase 2）

```bash
# CloudBase
EXPO_PUBLIC_CLOUDBASE_ENV_ID=xxx
CLOUDBASE_SECRET_ID=xxx      # 云函数内使用
CLOUDBASE_SECRET_KEY=xxx     # 云函数内使用

# 腾讯云 AI（仅云函数环境变量，前端不可见）
TENCENT_SECRET_ID=xxx
TENCENT_SECRET_KEY=xxx
GLM_API_KEY=xxx
```

---

## 十、不在本 PRD 范围内

- Web 端 / 管理后台
- 多用户数据共享
- 第三方账单导入（支付宝/微信账单）
- 消息推送
- 数据导出功能

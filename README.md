# CoCo AI 记账

一个聊天窗口 = 所有记账入口。语音、拍照、文字输入统一融合在 AI 对话界面中，支持离线优先架构。

<p align="center">
  <img src="ui/0310/design-final.png" width="280" alt="首页截图" />
</p>

## 功能亮点

- 🎙️ **语音记账** — 长按说话，AI 自动解析生成账单（腾讯云 ASR）
- 📷 **拍照识票** — 拍小票/发票，OCR + AI 自动录入（腾讯云 OCR）
- ⌨️ **文字记账** — 输入"午饭35"，本地规则引擎即时识别，无需联网
- 💬 **自然语言查询** — "上周花了多少钱吃饭"直接查账（GLM text-to-SQL）
- 📊 **收支统计** — 月报/周报、分类饼图、趋势折线图
- 🎯 **预算管理** — 分类预算 + 超支提醒
- 📤 **数据导出** — 按时间范围导出 CSV
- 🔌 **离线优先** — 本地规则引擎覆盖 80% 文字记账场景，后台静默同步

## 架构概览

```
┌─────────────────────────────────────────────────────┐
│                  apps/mobile                         │
│  ┌──────────┐  ┌────────────┐  ┌─────────────────┐  │
│  │ UI Layer │  │ Rule Engine│  │ Operation Queue  │  │
│  │ (expo-   │  │ (regex,    │  │ (expo-sqlite)    │  │
│  │  router) │  │  no LLM)   │  │                 │  │
│  └────┬─────┘  └─────┬──────┘  └────────┬────────┘  │
│       │              │                   │           │
│  ┌────▼──────────────▼───────────────────▼────────┐  │
│  │         React Query (Optimistic UI)            │  │
│  │         Zustand (Global State)                 │  │
│  └──────────────────────┬─────────────────────────┘  │
│                         │ SyncManager (netinfo)      │
└─────────────────────────┼────────────────────────────┘
                          │ HTTPS (online only)
┌─────────────────────────▼──────────────────────────┐
│                  apps/api (Next.js 14 BFF)          │
│           API Routes · Request Logging              │
└─────────────────────────┬──────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    Supabase         智谱 GLM        腾讯云
  (PostgreSQL        (NL理解/        (ASR/OCR)
   + Auth + RLS)     text-to-SQL)
```

## Monorepo 结构

```
coco/
├── apps/
│   ├── mobile/          # React Native Expo 55 客户端
│   │   ├── app/         # expo-router 路由
│   │   ├── components/  # UI 组件
│   │   ├── lib/
│   │   │   ├── queue/   # Operation Queue（离线写缓冲）
│   │   │   └── api.ts   # BFF API 客户端
│   │   ├── hooks/       # React Query hooks
│   │   └── store/       # Zustand stores
│   └── api/             # Next.js 14 BFF
│       └── src/         # API Routes
├── packages/
│   ├── shared/          # 共享 TypeScript 类型
│   └── ai/              # AI 处理库（GLM、腾讯云 OCR/ASR）
└── supabase/            # 数据库 schema / migrations
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 客户端 | React Native 0.83 (Expo 55) · TypeScript · React 19 |
| 路由 | expo-router |
| 状态管理 | Zustand 5 · React Query 5（Optimistic UI）|
| 离线存储 | expo-sqlite（Operation Queue）|
| 网络感知 | @react-native-community/netinfo |
| BFF | Next.js 14 · TypeScript |
| 数据库 | Supabase (PostgreSQL + Auth + RLS) |
| AI | 智谱 GLM (NL理解 / text-to-SQL) · 腾讯云 OCR / ASR |
| 工程化 | pnpm · Turborepo |
| 测试 | Jest · ts-jest · better-sqlite3 (SQLite mock) |

## 离线优先架构

CoCo 采用离线优先设计，确保无网络时也能正常记账：

1. **本地规则引擎** — 基于正则的客户端文本解析，覆盖 ~80% 日常文字记账，无需调用 LLM
2. **Operation Queue** — 写操作先持久化到 expo-sqlite，网络恢复后由 SyncManager 批量同步至 BFF
3. **Optimistic UI** — React Query 乐观更新，本地操作即时反映在界面，同步失败自动回滚
4. **SyncManager** — 监听 netinfo 网络状态，后台静默将队列中的操作同步到 Next.js BFF API

## 快速启动

```bash
# 克隆并安装依赖
git clone <repo-url>
cd coco
pnpm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入以下密钥：
#   SUPABASE_URL / SUPABASE_ANON_KEY
#   GLM_API_KEY（智谱 GLM）
#   TENCENT_SECRET_ID / TENCENT_SECRET_KEY（腾讯云 OCR/ASR）

# 启动所有服务
pnpm dev

# 单独启动
pnpm --filter @coco/mobile dev   # Expo 开发服务
pnpm --filter @coco/api dev      # Next.js BFF
```

详细的环境变量说明见 [.env.example](.env.example)。

## 测试

```bash
# 运行 mobile 测试
pnpm --filter @coco/mobile test
```

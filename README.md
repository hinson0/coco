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
│                apps/backend (FastAPI)               │
│         /record-asr · /record-ocr · /record-text   │
└─────────────────────────┬──────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    PostgreSQL       智谱 GLM        腾讯云
  (Docker本地        (NL理解/        (ASR/OCR)
   + JWT认证)        text-to-SQL)
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
│   │   │   └── api.ts   # HTTP 客户端（指向 FastAPI）
│   │   ├── hooks/       # React Query hooks
│   │   └── store/       # Zustand stores
│   └── backend/         # Python FastAPI 后端 (详见 [backend README](apps/backend/README.md))
        ├── routers/     # HTTP 路由（asr / ocr / text）
│       ├── services/    # AI 调用逻辑（腾讯云 / GLM）
│       ├── schemas/     # Pydantic 请求/响应 schema
│       ├── models/      # SQLAlchemy ORM 模型
│       ├── config.py    # 环境变量配置
│       └── main.py      # FastAPI 入口
├── packages/
│   └── shared/          # 共享 TypeScript 类型 + 规则引擎
├── supabase/
│   └── migrations/      # 数据库 schema
└── docker-compose.yml   # 本地环境一键启动
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 客户端 | React Native 0.83 (Expo 55) · TypeScript · React 19 |
| 路由 | expo-router |
| 状态管理 | Zustand 5 · React Query 5（Optimistic UI）|
| 离线存储 | expo-sqlite（Operation Queue）|
| 网络感知 | @react-native-community/netinfo |
| 后端 | Python · FastAPI · uv · Docker |
| 数据库 | PostgreSQL (Docker) + JWT 认证 |
| AI | 智谱 GLM (NL理解 / text-to-SQL) · 腾讯云 OCR / ASR |
| 工程化 | pnpm workspace |
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

# 配置移动端环境变量
# 编辑 apps/mobile/.env：
#   EXPO_PUBLIC_API_URL=http://<本机局域网IP>:8000

# 配置后端环境变量
# 编辑 apps/backend/.env：
#   GLM_API_KEY
#   TENCENT_SECRET_ID / TENCENT_SECRET_KEY

# 启动后端（Docker）
docker compose up

# 启动移动端
pnpm dev
```

## 测试

```bash
# 运行 mobile 测试
pnpm --filter @coco/mobile test
```

# CoCo AI 记账

一个聊天窗口 = 所有记账入口。语音、拍照、文字输入统一融合在 AI 对话界面中，支持离线优先架构。

<p align="center">
  <img src="ui/0310/design-final.png" width="280" alt="首页截图" />
</p>

## 功能亮点

- 🎙️ **语音记账** — 长按说话，AI 自动解析生成账单（腾讯云 ASR）
- 📷 **拍照识票** — 拍小票/发票，OCR + AI 自动录入（腾讯云 OCR）
- ⌨️ **文字记账** — 输入"午饭35"，AI 自动解析生成账单（Qwen）
- 💬 **自然语言查询** — "上周花了多少钱吃饭"直接查账（Qwen text-to-SQL）
- 📊 **收支统计** — 月报/周报、分类饼图、趋势折线图
- 🎯 **预算管理** — 分类预算 + 超支提醒
- 📤 **数据导出** — 按时间范围导出 CSV
- 🔌 **离线存储** — 本地 SQLite 持久化，数据查看与编辑无需联网

## 架构概览

```
┌─────────────────────────────────────────────────────┐
│                  apps/mobile                         │
│  ┌──────────┐  ┌────────────┐  ┌─────────────────┐  │
│  │ UI Layer │  │ Local SQLite │  │ React Query  │  │
│  │ (expo-   │  │ (offline     │  │ (data layer) │  │
│  │  router) │  │  storage)    │  │              │  │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘  │
│       │               │                 │           │
│  ┌────▼───────────────▼─────────────────▼─────────┐  │
│  │              Zustand (Global State)            │  │
│  └──────────────────────┬─────────────────────────┘  │
│                         │                            │
└─────────────────────────┼────────────────────────────┘
                          │ HTTPS (online only)
┌─────────────────────────▼──────────────────────────┐
│                apps/backend (FastAPI)               │
│              /chat · /ocr                           │
└─────────────────────────┬──────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    PostgreSQL        Qwen           腾讯云
  (Docker本地        (SiliconFlow    (ASR/OCR)
   + JWT认证)        意图/账单/SQL)
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
│       ├── routers/     # HTTP 路由（asr / ocr / text）
│       ├── services/    # AI 调用逻辑（Qwen / 腾讯云）
│       ├── schemas/     # Pydantic 请求/响应 schema
│       ├── models/      # SQLAlchemy ORM 模型
│       ├── alembic/     # 数据库迁移（Alembic）
│       ├── infra/       # 基础设施配置
│       ├── tests/       # 后端测试（pytest）
│       ├── config.py    # 环境变量配置
│       └── main.py      # FastAPI 入口
├── packages/
│   └── shared/          # 共享 TypeScript 类型 + 常量
├── scripts/             # 开发脚本（worktree 等）
├── justfile             # 任务运行器（just）
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
| 数据库 | PostgreSQL (Docker) + JWT 认证 · Alembic 迁移 |
| AI | Qwen (SiliconFlow — 意图分类 / 账单提取 / text-to-SQL) · 腾讯云 OCR / ASR |
| 工程化 | pnpm workspace · just（任务运行器）|
| 测试 | Jest · ts-jest · pytest |

## 离线架构

CoCo 采用本地 SQLite 持久化，离线时可查看和编辑已有数据：

1. **本地 SQLite** — 所有数据（交易、分类、预算、聊天记录）持久化到 expo-sqlite，WAL 模式
2. **React Query** — 数据访问层，本地 CRUD 操作即时反映在界面
3. **在线记账** — 文字 / 语音 / 拍照记账需联网，由后端 Qwen AI 解析后写入本地数据库

## 快速启动

```bash
# 克隆并安装依赖
git clone <repo-url>
cd coco
just sync          # 等价于 pnpm install + uv sync

# 配置移动端环境变量
# 编辑 apps/mobile/.env：
#   EXPO_PUBLIC_API_URL=http://<本机局域网IP>:8000

# 配置后端环境变量
# 编辑 apps/backend/.env：
#   SILICON_API_KEY
#   TENCENT_SECRET_ID / TENCENT_SECRET_KEY

# 一键启动（Docker + 前后端开发服务器）
just dev
```

## 测试

```bash
# 运行 mobile 测试
pnpm --filter @coco/mobile test

# 运行 backend 测试
cd apps/backend && uv run pytest
```

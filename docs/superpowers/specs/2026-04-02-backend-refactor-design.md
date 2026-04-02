# 后端重构设计：Supabase Edge Functions → FastAPI

**日期**：2026-04-02  
**分支**：`worktree-refactor-backend`

---

## 背景

原后端由 3 个 Supabase Edge Functions（Deno 运行时）组成：

- `record-asr` — 腾讯云语音转文字
- `record-ocr` — 腾讯云 OCR + 正则提取收据信息
- `record-text` — GLM 文字记账 + 自然语言查询（text-to-SQL）

痛点：Supabase Edge Functions 本地调试体验差，日志不直观，热重载慢。

---

## 目标

1. 用 Python FastAPI 完全替代 3 个 Edge Functions（包括生产环境）
2. Docker 跑本地开发环境，`docker compose up` 一键启动
3. 整理 monorepo 目录结构，删除历史遗留死文件

---

## 目录结构变更

### 删除

| 路径 | 原因 |
|------|------|
| `supabase/functions/` | 由 FastAPI 接管 |
| `packages/ai/` | TypeScript AI 客户端，逻辑迁移到 Python |
| `scripts/sync-env.mjs` | `.envfiles/` 删除后职责消失 |
| `vite.config.ts` / `tailwind.config.js` / `postcss.config.js` / `index.html` / 根目录 `tsconfig.json` | 早期 CloudBase React Web App 遗留 |
| `eslint.config.js` / `eslint.config.ts`（根目录） | 重复文件，移进 `apps/mobile/` |
| `turbo.json` | 从未使用 Turborepo |

### 新增

| 路径 | 用途 |
|------|------|
| `apps/backend/` | Python FastAPI 后端 |
| `docker-compose.yml` | 根目录，本地一键启动 |

### 移动

| 原路径 | 新路径 |
|--------|--------|
| `.prettierrc` / `.prettierignore` | `apps/mobile/` |
| `eslint.config.js` | `apps/mobile/` |
| `ai-insights-mockup.png` | `docs/ui/` |

`packages/shared/` 通过软链接使用 `apps/mobile/.prettierrc`。

---

## FastAPI 项目结构

```
apps/backend/
├── main.py              # FastAPI app 入口，注册所有 router
├── routers/
│   ├── asr.py           # POST /record-asr
│   ├── ocr.py           # POST /record-ocr
│   └── text.py          # POST /record-text
├── services/
│   ├── tencent.py       # 腾讯云 ASR / OCR 调用
│   └── glm.py           # GLM API 调用
├── schemas/             # Pydantic 请求/响应 schema
├── models/              # SQLAlchemy ORM（text-to-SQL 查询功能用）
├── config.py            # pydantic-settings 读取环境变量
├── pyproject.toml       # uv 依赖管理（类比 package.json）
└── Dockerfile
```

**包管理器**：`uv`（非 pip）

---

## Docker 本地环境

```yaml
# docker-compose.yml（根目录）
services:
  backend:
    build: ./apps/backend
    ports:
      - "8000:8000"
    env_file:
      - ./apps/backend/.env
    volumes:
      - ./apps/backend:/app   # 热重载：本地改代码容器立即生效
```

不起本地数据库容器，继续连 Supabase 云端 PostgreSQL。

---

## 移动端对接

`apps/mobile/lib/api.ts` 的 base URL 从硬编码改为环境变量：

```ts
// 改前
const API_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL! + "/functions/v1";

// 改后
const API_BASE = process.env.EXPO_PUBLIC_API_URL;
```

`apps/mobile/.env`：
```
EXPO_PUBLIC_API_URL=http://<本机局域网IP>:8000
```

同时删除 `apikey` header（Supabase 网关专用，FastAPI 不需要）。`Authorization: Bearer <JWT>` 保留，供后续认证使用。

---

## 环境变量

### `apps/mobile/.env`

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_URL=http://<本机IP>:8000
```

### `apps/backend/.env`

```
GLM_API_KEY=
TENCENT_SECRET_ID=
TENCENT_SECRET_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## 接口规格（与原 Edge Functions 一致）

### `POST /record-asr`

```json
// 请求
{ "audioBase64": "<base64 string>" }

// 响应
{ "data": { "asrText": "识别出的文字" } }
```

### `POST /record-ocr`

```json
// 请求
{ "imageBase64": "<base64 string>" }

// 响应（成功识别）
{ "data": { "type": "bill", "transaction": { "amount": 35.0, "category": "餐饮", "note": "...", "type": "expense", "occurred_at": "..." } } }

// 响应（无法识别金额）
{ "data": { "type": "ocr_text", "ocrText": "...", "merchant": "..." } }
```

### `POST /record-text`

```json
// 请求
{ "text": "午饭35" }

// 响应（记账意图）
{ "data": { "type": "bill", "transaction": { ... } } }

// 响应（查询意图）
{ "data": { "type": "nl_result", "message": "本月餐饮支出 428 元" } }
```

---

## 协作分工（Learning 模式）

- Python 后端代码：100% 由用户编写，Claude 提供指导和 review
- 目录结构创建：100% 由用户执行
- 前端改动（`api.ts` 等）：用户 30%+，Claude 辅助 70%

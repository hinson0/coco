# 设计文档：用本地 PostgreSQL 替换 Supabase

**日期：** 2026-04-07  
**分支：** feat-docker  
**状态：** 待实施

---

## 背景

项目当前使用 Supabase 提供认证（Auth）和数据库服务。目标是：

1. 移除对 Supabase 云服务的依赖
2. 用 Docker Compose 在本地运行 PostgreSQL
3. 在 FastAPI 后端自建 JWT 认证体系
4. 用 `concurrently` 实现一条命令启动所有开发服务

---

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                        开发机                            │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Docker Compose                       │   │
│  │   ┌───────────────┐                              │   │
│  │   │  PostgreSQL   │  localhost:5432              │   │
│  │   │  (postgres:16)│                              │   │
│  │   └───────────────┘                              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────┐   ┌────────────────────────┐   │
│  │   FastAPI           │   │   Expo Metro Bundler   │   │
│  │   localhost:8000    │   │   localhost:8081       │   │
│  │   (uvicorn --reload)│   │   (pnpm dev)           │   │
│  └─────────────────────┘   └────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                    局域网 IP
                         │
             ┌───────────────────┐
             │   真机 Expo Go    │
             │  192.168.x.x      │
             └───────────────────┘
```

### 启动命令

```bash
# 第一次初始化（仅需一次）
pnpm dev:infra    # 启动 PostgreSQL
pnpm db:migrate   # 建表 + 插入默认数据

# 日常开发（一条命令）
pnpm dev:all

# 数据库重置（清空重建）
pnpm db:reset
```

---

## 一、Docker 配置

### `docker-compose.yml`（项目根目录，新增）

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: coco
      POSTGRES_USER: coco
      POSTGRES_PASSWORD: coco
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## 二、根目录 `package.json` 脚本

```json
{
  "scripts": {
    "dev:infra": "docker compose up -d",
    "dev:backend": "cd apps/backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000",
    "dev:frontend": "pnpm --filter mobile dev",
    "dev:all": "pnpm dev:infra && concurrently -n backend,frontend -c blue,green \"pnpm dev:backend\" \"pnpm dev:frontend\"",
    "db:migrate": "docker exec -i coco-postgres-1 psql -U coco -d coco < supabase/migrations/001_initial_schema.sql && docker exec -i coco-postgres-1 psql -U coco -d coco < supabase/seed.sql",
    "db:reset": "docker compose down -v && docker compose up -d && sleep 2 && pnpm db:migrate"
  }
}
```

新增 devDependency：`concurrently`

---

## 三、数据库 Schema 改动

### 改动点（`supabase/migrations/001_initial_schema.sql`）

1. **新增 `users` 表**（放在最前面）：
   ```sql
   CREATE TABLE users (
     id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     email      text NOT NULL UNIQUE,
     password   text NOT NULL,  -- bcrypt hash
     created_at timestamptz NOT NULL DEFAULT now()
   );
   ```

2. **所有表的外键从 `auth.users` 改为 `users`**：
   ```sql
   -- 原来
   user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
   -- 改为
   user_id uuid REFERENCES users(id) ON DELETE CASCADE
   ```

3. **删除所有 RLS 策略**（约 20 行），用户隔离改到应用层（FastAPI 查询中手动加 `WHERE user_id = :current_user`）。

4. **删除 `exec_readonly_sql` 函数**，NL 查询改为后端直接执行 SQL。

---

## 四、后端改动

### 目录结构

```
apps/backend/
├── main.py                    ← 入口，留在根目录
├── infra/                     ← 新建：基础设施配置
│   ├── __init__.py
│   ├── config.py              ← 从根目录移入，新增 jwt_* 和 database_url
│   ├── logging_config.py      ← 从根目录移入
│   └── database.py            ← 新增：SQLAlchemy async 连接
├── models/                    ← 不动
├── schemas/                   ← 不动
├── services/                  ← 不动
├── routers/
│   ├── auth.py                ← 新增
│   ├── chat.py                ← 改动
│   └── ocr.py                 ← 不动
└── tests/                     ← 不动
```

### `infra/config.py` 变量变更

删除：
- `supabase_url`
- `supabase_service_role_key`

新增：
- `database_url`
- `jwt_secret`
- `jwt_access_expire_minutes`（默认 60）
- `jwt_refresh_expire_days`（默认 30）

### `infra/database.py`（新增）

使用 SQLAlchemy async engine 连接 PostgreSQL，暴露 `get_db()` 依赖注入。

### `routers/auth.py`（新增）

| 路由 | 方法 | 说明 |
|---|---|---|
| `/auth/register` | POST | 注册，bcrypt 加密密码 |
| `/auth/login` | POST | 登录，返回 access_token + refresh_token |
| `/auth/refresh` | POST | 用 refresh_token 换新 access_token |

**Token 规格：**

| | access_token | refresh_token |
|---|---|---|
| 有效期 | 1 小时 | 30 天 |
| 算法 | HS256 | HS256 |
| 签名密钥 | JWT_SECRET | JWT_SECRET |
| 存储位置 | AsyncStorage | AsyncStorage |

### `routers/chat.py` 改动

- 删除 `create_client()`、`supabase.rpc()` 调用
- 删除 `get_user_id()` 函数
- 改用 `Depends(get_current_user)` 统一注入当前用户
- NL 查询改为通过 `infra.database` 直接执行 SQL

### `pyproject.toml` 依赖变更

删除：
- `supabase>=2.28.3`

新增：
- `python-jose` — JWT 签发/验证
- `passlib[bcrypt]` — 密码 hash
- `sqlalchemy[asyncio]` — ORM + async 支持
- `asyncpg` — PostgreSQL async 驱动

### 环境变量（`apps/backend/.env`）

```env
DATABASE_URL=postgresql+asyncpg://coco:coco@localhost:5432/coco
JWT_SECRET=<随机长字符串>
JWT_ACCESS_EXPIRE_MINUTES=60
JWT_REFRESH_EXPIRE_DAYS=30
```

---

## 五、前端改动

### 文件变动

| 操作 | 文件 |
|---|---|
| 删除 | `apps/mobile/lib/supabase.ts` |
| 新增 | `apps/mobile/lib/auth.ts` |
| 改动 | `apps/mobile/lib/api.ts` |
| 改写 | `apps/mobile/hooks/useAuth.ts` |

### `lib/auth.ts`（新增）

封装所有认证接口调用，管理 AsyncStorage 中的 token：

```typescript
const ACCESS_TOKEN_KEY = "access_token"
const REFRESH_TOKEN_KEY = "refresh_token"

export async function login(email: string, password: string): Promise<void>
export async function register(email: string, password: string): Promise<void>
export async function logout(): Promise<void>
export async function getAccessToken(): Promise<string | null>
export async function refreshAccessToken(): Promise<string | null>
```

### `lib/api.ts` 改动

- token 从 `getAccessToken()` 读取，不再依赖 Supabase session
- 新增 401 自动 refresh 重试逻辑

### `hooks/useAuth.ts` 改写

- 删除所有 `supabase.auth.*` 调用和 `Session` 类型引用
- App 启动时读 AsyncStorage 判断登录状态
- 登录/登出更新 React Context

### 环境变量（`apps/mobile/.env`）

```env
# 删除
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# 新增（填局域网 IP）
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000
```

删除依赖：`@supabase/supabase-js`

---

## 六、清理

| 操作 | 文件 |
|---|---|
| 删除 | `supabase/config.toml` |
| 保留并改写 | `supabase/migrations/001_initial_schema.sql` |
| 保留不动 | `supabase/seed.sql` |

测试文件 `tests/test_chat_router.py` 中的 `patch("routers.chat.create_client")` 改为 mock `infra.database.get_db`。

---

## 完整改动文件清单

| 操作 | 文件 |
|---|---|
| 新增 | `docker-compose.yml` |
| 新增 | `apps/backend/infra/__init__.py` |
| 新增 | `apps/backend/infra/database.py` |
| 新增 | `apps/backend/routers/auth.py` |
| 新增 | `apps/mobile/lib/auth.ts` |
| 改写 | `supabase/migrations/001_initial_schema.sql` |
| 改动 | 根目录 `package.json` |
| 改动 | `apps/backend/main.py` |
| 移动 | `apps/backend/config.py` → `apps/backend/infra/config.py` |
| 移动 | `apps/backend/logging_config.py` → `apps/backend/infra/logging_config.py` |
| 改动 | `apps/backend/routers/chat.py` |
| 改动 | `apps/backend/tests/test_chat_router.py` |
| 改动 | `apps/mobile/lib/api.ts` |
| 改写 | `apps/mobile/hooks/useAuth.ts` |
| 删除 | `apps/mobile/lib/supabase.ts` |
| 删除 | `supabase/config.toml` |
| 改动 | `apps/backend/pyproject.toml` |
| 改动 | `apps/mobile/package.json` |
| 改动 | `apps/backend/.env.example` |
| 改动 | `apps/mobile/.env.example` |

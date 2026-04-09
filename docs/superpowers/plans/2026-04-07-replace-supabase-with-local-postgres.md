# 用本地 PostgreSQL 替换 Supabase 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除 Supabase 依赖，用 Docker 运行本地 PostgreSQL，FastAPI 自建 JWT 认证，`pnpm dev:all` 一条命令启动所有开发服务。

**Architecture:** Docker Compose 负责基础设施（PostgreSQL），FastAPI 和 Expo Metro Bundler 本地运行。后端新增 `infra/` 层存放 config、logging、database、security 模块，认证改为 JWT（access + refresh token）存储在 AsyncStorage。

**Tech Stack:** Python: PyJWT, passlib[bcrypt], SQLAlchemy[asyncio], asyncpg；前端: 原生 fetch + AsyncStorage；基础设施: Docker Compose + postgres:16；开发脚本: concurrently

---

## 文件结构总览

```
# 新增
docker-compose.yml
apps/backend/infra/__init__.py
apps/backend/infra/config.py         ← 原 config.py 移入 + 新增 jwt_*/database_url
apps/backend/infra/logging_config.py ← 原 logging_config.py 移入（内容不变）
apps/backend/infra/database.py       ← 新增：SQLAlchemy async engine
apps/backend/infra/security.py       ← 新增：JWT 工具 + get_current_user 依赖
apps/backend/schemas/auth.py         ← 新增：认证接口的请求/响应 schema
apps/backend/routers/auth.py         ← 新增：/auth/register /auth/login /auth/refresh
apps/backend/tests/test_auth_router.py
apps/mobile/lib/auth.ts              ← 新增：封装认证接口 + AsyncStorage 管理

# 修改
package.json                         ← 根目录，加 dev 脚本
apps/backend/pyproject.toml          ← 换依赖
apps/backend/main.py                 ← 更新 import 路径
apps/backend/routers/__init__.py     ← 注册 auth router
apps/backend/routers/chat.py         ← 移除 supabase，改用新依赖
apps/backend/tests/test_chat_router.py
apps/backend/tests/test_logging_config.py ← 更新 import
apps/mobile/lib/api.ts               ← token 来源改为 AsyncStorage
apps/mobile/hooks/useAuth.ts         ← 改写：不再依赖 supabase
apps/mobile/app/_layout.tsx          ← session → isAuthenticated
supabase/migrations/001_initial_schema.sql ← 删 RLS/auth.users，加 users 表
apps/backend/.env.example
apps/mobile/.env.example

# 删除
supabase/config.toml
apps/mobile/lib/supabase.ts
apps/backend/config.py               ← 移入 infra/
apps/backend/logging_config.py       ← 移入 infra/
```

---

## Task 1：Docker 基础设施 + package.json 脚本

**Files:**

- Create: `docker-compose.yml`
- Modify: `package.json`（根目录）

- [ ] **Step 1：写 `docker-compose.yml`**

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

- [ ] **Step 2：在根目录 `package.json` 加 dev 脚本 + devDependency**

将 `package.json` 改为：

```json
{
  "name": "coco",
  "version": "1.0.1",
  "scripts": {
    "dev": "pnpm --filter mobile dev",
    "dev:infra": "docker compose up -d",
    "dev:backend": "cd apps/backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000",
    "dev:frontend": "pnpm --filter mobile dev",
    "dev:all": "pnpm dev:infra && concurrently -n backend,frontend -c blue,green \"pnpm dev:backend\" \"pnpm dev:frontend\"",
    "db:migrate": "docker exec -i coco-postgres-1 psql -U coco -d coco < supabase/migrations/001_initial_schema.sql && docker exec -i coco-postgres-1 psql -U coco -d coco < supabase/seed.sql",
    "db:reset": "docker compose down -v && docker compose up -d && sleep 2 && pnpm db:migrate",
    "w": "node scripts/worktree-dev.mjs",
    "test": "pnpm --filter mobile test",
    "test:scripts": "node --test scripts/__tests__/*.test.mjs"
  },
  "devDependencies": {
    "concurrently": "^9.1.2"
  },
  "packageManager": "pnpm@10.30.3"
}
```

- [ ] **Step 3：安装 concurrently**

```bash
pnpm install
```

期望输出：`Done in ...s`

- [ ] **Step 4：验证 Docker 启动**

```bash
docker compose up -d
docker compose ps
```

期望输出：`coco-postgres-1   Up`

- [ ] **Step 5：Commit**

```bash
git add docker-compose.yml package.json pnpm-lock.yaml
git commit -m "feat: 添加 Docker Compose + pnpm dev:all 启动脚本"
```

---

## Task 2：改写数据库 Schema

**Files:**

- Modify: `supabase/migrations/001_initial_schema.sql`
- Delete: `supabase/config.toml`

- [ ] **Step 1：将 `supabase/migrations/001_initial_schema.sql` 改为以下内容**

去掉所有 `auth.users` 引用、所有 RLS 策略、`exec_readonly_sql` 函数；新增 `users` 表：

```sql
-- Enums
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE record_source AS ENUM ('manual', 'ocr', 'asr', 'text');
CREATE TYPE budget_period AS ENUM ('weekly', 'monthly', 'yearly');
CREATE TYPE chat_role AS ENUM ('user', 'assistant');
CREATE TYPE chat_content_type AS ENUM ('text', 'audio', 'image', 'bill_card', 'nl_result');

-- Users（替换 Supabase auth.users）
CREATE TABLE users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  password   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Categories
CREATE TABLE categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  icon       text NOT NULL DEFAULT '📦',
  type       transaction_type NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Transactions
CREATE TABLE transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  uuid NOT NULL REFERENCES categories(id),
  amount       numeric(12,2) NOT NULL,
  type         transaction_type NOT NULL,
  note         text NOT NULL DEFAULT '',
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  source       record_source NOT NULL DEFAULT 'manual',
  raw_input    text,
  receipt_url  text,
  ai_confidence real,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX idx_transactions_user_occurred
  ON transactions (user_id, occurred_at DESC)
  WHERE deleted_at IS NULL;

-- Budgets
CREATE TABLE budgets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id),
  amount      numeric(12,2) NOT NULL,
  period      budget_period NOT NULL DEFAULT 'monthly',
  start_date  date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, period)
);

-- Chat Messages
CREATE TABLE chat_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role           chat_role NOT NULL,
  content_type   chat_content_type NOT NULL DEFAULT 'text',
  content        text NOT NULL,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_user_created ON chat_messages (user_id, created_at DESC);

-- NL Query Logs
CREATE TABLE nl_query_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question       text NOT NULL,
  generated_sql  text NOT NULL,
  result_summary text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2：删除 `supabase/config.toml`**

- [ ] **Step 3：验证 schema 可以应用到 Docker PostgreSQL**

先确认 Docker 已运行（Task 1 已启动），然后：

```bash
pnpm db:migrate
```

期望输出：无报错，最后一行类似 `INSERT 0 12`（seed.sql 的默认分类）

- [ ] **Step 4：Commit**

```bash
git add supabase/migrations/001_initial_schema.sql
git rm supabase/config.toml
git commit -m "feat: 改写 schema 替换 auth.users/RLS，新增 users 表"
```

---

## Task 3：更新后端 Python 依赖

**Files:**

- Modify: `apps/backend/pyproject.toml`

> 注意：本 Task 只**新增**依赖，不删除旧依赖（supabase/python-jose）。旧依赖在 Task 6 代码全部更新后才删除。

- [ ] **Step 1：在 `apps/backend/pyproject.toml` 新增依赖**

将 `dependencies` 改为：

```toml
dependencies = [
    "asyncpg>=0.30.0",
    "fastapi>=0.135.3",
    "httpx>=0.28.1",
    "passlib[bcrypt]>=1.7.4",
    "pydantic-settings>=2.13.1",
    "PyJWT>=2.10.1",
    "python-jose>=3.5.0",
    "sqlalchemy[asyncio]>=2.0.40",
    "structlog>=25.5.0",
    "supabase>=2.28.3",
    "tencentcloud-sdk-python>=3.1.70",
    "uvicorn[standard]>=0.42.0",
]
```

- [ ] **Step 2：同步依赖**

```bash
cd apps/backend && uv sync
```

期望输出：`Resolved ... packages` 无 ERROR

- [ ] **Step 3：验证新包可以 import**

```bash
cd apps/backend && uv run python -c "import jwt; import passlib; import sqlalchemy; import asyncpg; print('OK')"
```

期望输出：`OK`

- [ ] **Step 4：Commit**

```bash
git add apps/backend/pyproject.toml apps/backend/uv.lock
git commit -m "feat(backend): 新增 PyJWT/passlib/sqlalchemy/asyncpg 依赖"
```

---

## Task 4：重组后端目录——创建 `infra/` 层

**Files:**

- Create: `apps/backend/infra/__init__.py`
- Create: `apps/backend/infra/config.py`
- Create: `apps/backend/infra/logging_config.py`
- Create: `apps/backend/infra/database.py`
- Create: `apps/backend/infra/security.py`
- Modify: `apps/backend/main.py`
- Modify: `apps/backend/routers/chat.py`（仅更新 import 路径）
- Modify: `apps/backend/tests/test_logging_config.py`
- Delete: `apps/backend/config.py`
- Delete: `apps/backend/logging_config.py`

> uvicorn 从 `apps/backend/` 目录启动，sys.path 根是 `apps/backend/`。所以 `from infra.config import settings` 可以直接用。

- [ ] **Step 1：更新 `apps/backend/.env.example` 并同步你的 `apps/backend/.env`**

`.env.example` 改为：

```env
# 数据库
DATABASE_URL=postgresql+asyncpg://coco:coco@localhost:5432/coco

# JWT（生产环境请换成随机长字符串）
JWT_SECRET=dev-secret-change-in-production
JWT_ACCESS_EXPIRE_MINUTES=60
JWT_REFRESH_EXPIRE_DAYS=30

# 腾讯云
TENCENT_SECRET_ID=
TENCENT_SECRET_KEY=

# SiliconFlow
SILICON_API_KEY=

# Logging
APP_ENV=dev
LOG_LEVEL=DEBUG
```

**你的 `apps/backend/.env` 需要包含上述所有变量。** 生成随机 JWT_SECRET：

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

- [ ] **Step 2：创建 `apps/backend/infra/__init__.py`**

文件内容为空。

- [ ] **Step 3：创建 `apps/backend/infra/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    silicon_api_key: str
    tencent_secret_id: str
    tencent_secret_key: str
    database_url: str
    jwt_secret: str
    jwt_access_expire_minutes: int = 60
    jwt_refresh_expire_days: int = 30

    # Logging
    app_env: str = "dev"
    log_level: str = "DEBUG"


settings = Settings()  # pyright: ignore[reportCallIssue]
```

- [ ] **Step 4：创建 `apps/backend/infra/logging_config.py`**

内容与原 `apps/backend/logging_config.py` 完全一致（原样复制）：

```python
import logging

import structlog
from structlog.processors import CallsiteParameter, CallsiteParameterAdder


def setup_logging(env: str = "dev", level: str = "DEBUG") -> None:
    """配置全局 structlog。

    仅应在应用启动时（lifespan）调用一次。
    logging.basicConfig() 多次调用为 no-op，重复调用不会更新 stdlib 日志级别。
    """
    log_level = getattr(logging, level.upper(), logging.DEBUG)

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S.%f", utc=False),
        CallsiteParameterAdder([CallsiteParameter.MODULE]),
        structlog.processors.StackInfoRenderer(),
    ]

    if env == "prod":
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=shared_processors + [renderer],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )

    logging.basicConfig(level=log_level)
    logging.getLogger("tencentcloud_sdk_common").propagate = False
    logging.getLogger("urllib3").setLevel(logging.WARNING)
```

- [ ] **Step 5：创建 `apps/backend/infra/database.py`**

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from infra.config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 6：创建 `apps/backend/infra/security.py`**

```python
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from infra.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_expire_minutes
    )
    return jwt.encode(
        {"sub": user_id, "type": "access", "exp": expire},
        settings.jwt_secret,
        algorithm="HS256",
    )


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.jwt_refresh_expire_days
    )
    return jwt.encode(
        {"sub": user_id, "type": "refresh", "exp": expire},
        settings.jwt_secret,
        algorithm="HS256",
    )


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> str:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("type") != "access":
            raise ValueError("Not an access token")
        return str(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
```

- [ ] **Step 7：更新 `apps/backend/main.py`**

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from infra.config import settings
from infra.logging_config import setup_logging
from routers import all_routers


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings.app_env, settings.log_level)
    yield


app = FastAPI(title="CoCo backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(all_routers)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 8：更新 `apps/backend/routers/chat.py` 的 import（仅改 config 那一行，其余不动）**

将第 4 行：

```python
from config import settings
```

改为：

```python
from infra.config import settings
```

其余代码暂时不变（supabase/jose 的 import 在 Task 6 统一处理）。

- [ ] **Step 9：更新 `apps/backend/tests/test_logging_config.py` 的 import**

将第 6 行：

```python
from logging_config import setup_logging
```

改为：

```python
from infra.logging_config import setup_logging
```

- [ ] **Step 10：删除旧文件**

```bash
rm apps/backend/config.py
rm apps/backend/logging_config.py
```

- [ ] **Step 11：运行现有测试，确认通过**

```bash
cd apps/backend && uv run pytest -v
```

期望输出：所有已有测试（test_logging_config、test_ocr_router、test_silicon、test_chat_router）PASSED

- [ ] **Step 12：Commit**

```bash
git add apps/backend/infra/ apps/backend/main.py apps/backend/routers/chat.py \
        apps/backend/tests/test_logging_config.py apps/backend/.env.example
git rm apps/backend/config.py apps/backend/logging_config.py
git commit -m "refactor(backend): 重组目录，config/logging/database/security 移入 infra/"
```

---

## Task 5：后端 JWT 认证路由（TDD）

**Files:**

- Create: `apps/backend/schemas/auth.py`
- Create: `apps/backend/tests/test_auth_router.py`（先写）
- Create: `apps/backend/routers/auth.py`（后写）
- Modify: `apps/backend/routers/__init__.py`

- [ ] **Step 1：创建 `apps/backend/schemas/auth.py`**

```python
from pydantic import BaseModel


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str
```

- [ ] **Step 2：写失败测试 `apps/backend/tests/test_auth_router.py`**

```python
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from infra.database import get_db
from main import app

client = TestClient(app)


def _make_db(scalar_result=None):
    """构造一个 mock AsyncSession。

    scalar_result: SELECT id 的返回值（None 表示用户不存在，uuid 表示用户已存在）
    """
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = scalar_result
    result.mappings.return_value.one_or_none.return_value = None
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()
    return db


@pytest.fixture(autouse=True)
def reset_db_override():
    yield
    app.dependency_overrides.pop(get_db, None)


# ── /auth/register ────────────────────────────────────

def test_register_success():
    async def mock_db():
        yield _make_db(scalar_result=None)  # 邮箱不存在

    app.dependency_overrides[get_db] = mock_db

    resp = client.post("/auth/register", json={"email": "a@b.com", "password": "secret"})
    assert resp.status_code == 201
    assert resp.json()["message"] == "registered"


def test_register_duplicate_email():
    async def mock_db():
        yield _make_db(scalar_result="existing-uuid")  # 邮箱已存在

    app.dependency_overrides[get_db] = mock_db

    resp = client.post("/auth/register", json={"email": "a@b.com", "password": "secret"})
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"]


# ── /auth/login ───────────────────────────────────────

def test_login_wrong_password():
    """密码错误返回 401"""
    # 先注册（真实 bcrypt hash）
    from passlib.context import CryptContext
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed = pwd.hash("correct_password")

    db = AsyncMock()
    result = MagicMock()
    result.mappings.return_value.one_or_none.return_value = {
        "id": "user-uuid",
        "password": hashed,
    }
    db.execute = AsyncMock(return_value=result)

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    resp = client.post("/auth/login", json={"email": "a@b.com", "password": "wrong"})
    assert resp.status_code == 401


def test_login_success_returns_tokens():
    from passlib.context import CryptContext
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed = pwd.hash("secret")

    db = AsyncMock()
    result = MagicMock()
    result.mappings.return_value.one_or_none.return_value = {
        "id": "user-uuid",
        "password": hashed,
    }
    db.execute = AsyncMock(return_value=result)

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    resp = client.post("/auth/login", json={"email": "a@b.com", "password": "secret"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


# ── /auth/refresh ─────────────────────────────────────

def test_refresh_with_valid_refresh_token():
    from datetime import datetime, timedelta, timezone

    import jwt

    from infra.config import settings

    refresh_token = jwt.encode(
        {
            "sub": "user-uuid",
            "type": "refresh",
            "exp": datetime.now(timezone.utc) + timedelta(days=30),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )

    resp = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_refresh_with_access_token_fails():
    """access_token 不能用来 refresh"""
    from datetime import datetime, timedelta, timezone

    import jwt

    from infra.config import settings

    access_token = jwt.encode(
        {
            "sub": "user-uuid",
            "type": "access",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )

    resp = client.post("/auth/refresh", json={"refresh_token": access_token})
    assert resp.status_code == 401
```

- [ ] **Step 3：运行测试，确认失败（路由不存在）**

```bash
cd apps/backend && uv run pytest tests/test_auth_router.py -v
```

期望输出：全部 FAILED，原因为 404 或 ImportError（routers/auth.py 还不存在）

- [ ] **Step 4：创建 `apps/backend/routers/auth.py`**

```python
import jwt
import structlog
from fastapi import APIRouter, Depends, HTTPException
from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from infra.config import settings
from infra.database import get_db
from infra.security import create_access_token, create_refresh_token
from schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse

log = structlog.get_logger()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
async def register(
    body: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": body.email},
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="邮箱已经注册过了.")

    hashed = pwd_context.hash(body.password)
    await db.execute(
        text("INSERT INTO users (email, password) VALUES (:email, :password)"),
        {"email": body.email, "password": hashed},
    )
    await db.commit()
    return {"message": "registered"}


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        text("SELECT id, password FROM users WHERE email = :email"),
        {"email": body.email},
    )
    row = result.mappings().one_or_none()
    if row is None or not pwd_context.verify(body.password, row["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id = str(row["id"])
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest):
    try:
        payload = jwt.decode(body.refresh_token, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("type") != "refresh":
            raise ValueError("Not a refresh token")
        user_id: str = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )
```

- [ ] **Step 5：注册 auth router，更新 `apps/backend/routers/__init__.py`**

```python
from fastapi import APIRouter

from .auth import router as auth_router
from .chat import router as chat_router
from .ocr import router as ocr_router

all_routers = APIRouter()

all_routers.include_router(auth_router)
all_routers.include_router(ocr_router)
all_routers.include_router(chat_router)
```

- [ ] **Step 6：运行测试，确认通过**

```bash
cd apps/backend && uv run pytest tests/test_auth_router.py -v
```

期望输出：全部 PASSED

- [ ] **Step 7：运行全量测试，确认无回归**

```bash
cd apps/backend && uv run pytest -v
```

期望输出：全部 PASSED

- [ ] **Step 8：Commit**

```bash
git add apps/backend/schemas/auth.py apps/backend/routers/auth.py \
        apps/backend/routers/__init__.py apps/backend/tests/test_auth_router.py
git commit -m "feat(backend): 新增 JWT 认证路由 /auth/register /auth/login /auth/refresh"
```

---

## Task 6：更新 chat 路由 + 移除旧依赖（TDD）

**Files:**

- Modify: `apps/backend/tests/test_chat_router.py`（先更新测试）
- Modify: `apps/backend/routers/chat.py`（再更新实现）
- Modify: `apps/backend/pyproject.toml`（最后移除旧依赖）

- [ ] **Step 1：更新 `apps/backend/tests/test_chat_router.py`**

```python
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from infra.database import get_db
from infra.security import get_current_user
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def override_auth_and_db():
    """所有 chat 测试：mock 认证（返回固定 user_id）+ mock 数据库"""

    async def mock_db():
        db = AsyncMock()
        yield db

    app.dependency_overrides[get_current_user] = lambda: "user-123"
    app.dependency_overrides[get_db] = mock_db
    yield
    app.dependency_overrides.clear()


# ── record 意图 ───────────────────────────────────────
@patch("routers.chat.classify_intent", new_callable=AsyncMock, return_value="record")
@patch(
    "routers.chat.extract_bill",
    new_callable=AsyncMock,
    return_value={
        "amount": 58.5,
        "category": "餐饮",
        "note": "午饭",
        "type": "expense",
        "occurred_at": "2026-04-03T12:00:00+08:00",
    },
)
def test_chat_record_success(mock_bill, mock_intent):
    resp = client.post("/chat", json={"text": "午饭花了58.5"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "bill"
    assert data["transaction"]["amount"] == 58.5
    assert data["transaction"]["category"] == "餐饮"


@patch("routers.chat.classify_intent", new_callable=AsyncMock, return_value="record")
@patch("routers.chat.extract_bill", new_callable=AsyncMock, return_value=None)
def test_chat_record_fail(mock_bill, mock_intent):
    resp = client.post("/chat", json={"text": "随便说说"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "text"
    assert "手动记账" in data["content"]


# ── chat 意图 ─────────────────────────────────────────
@patch("routers.chat.classify_intent", new_callable=AsyncMock, return_value="chat")
@patch(
    "routers.chat.chat_reply",
    new_callable=AsyncMock,
    return_value="你好！有什么我可以帮你的？",
)
def test_chat_casual(mock_reply, mock_intent):
    resp = client.post("/chat", json={"text": "你好"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "text"
    assert "你好" in data["content"]


# ── is_safe_sql 安全校验 ──────────────────────────────
@patch("routers.chat.classify_intent", new_callable=AsyncMock, return_value="query")
@patch(
    "routers.chat.generate_sql",
    new_callable=AsyncMock,
    return_value="DELETE FROM transactions",
)
def test_chat_query_unsafe_sql(mock_sql, mock_intent):
    resp = client.post("/chat", json={"text": "删掉所有记录"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "text"
    assert "查询失败" in data["content"]


# ── 语音输入 ──────────────────────────────────────────
@patch("routers.chat.classify_intent", new_callable=AsyncMock, return_value="record")
@patch(
    "routers.chat.extract_bill",
    new_callable=AsyncMock,
    return_value={
        "amount": 30,
        "category": "餐饮",
        "note": "咖啡",
        "type": "expense",
        "occurred_at": "2026-04-04T10:00:00+08:00",
    },
)
@patch("routers.chat.recognize_speech", return_value="买了杯咖啡30块")
def test_chat_audio_record(mock_asr, mock_bill, mock_intent):
    resp = client.post("/chat", json={"audioBase64": "fakebase64"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "bill"
    assert data["asrText"] == "买了杯咖啡30块"
    assert data["transaction"]["amount"] == 30


@patch("routers.chat.recognize_speech", return_value="")
def test_chat_audio_empty_asr(mock_asr):
    resp = client.post("/chat", json={"audioBase64": "fakebase64"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "text"
    assert "没听清" in data["content"]


def test_chat_no_text_no_audio():
    resp = client.post("/chat", json={})
    assert resp.status_code == 422


# ── query 意图返回 nl_result ─────────────────────────
@patch("routers.chat.classify_intent", new_callable=AsyncMock, return_value="query")
@patch(
    "routers.chat.generate_sql",
    new_callable=AsyncMock,
    return_value="SELECT SUM(amount) FROM transactions WHERE deleted_at IS NULL",
)
@patch(
    "routers.chat.summarize_result",
    new_callable=AsyncMock,
    return_value="本月共消费 2350.00 元",
)
def test_chat_query_returns_nl_result(mock_summary, mock_sql, mock_intent):
    mock_db_result = MagicMock()
    mock_db_result.mappings.return_value.all.return_value = [{"sum": 2350}]

    async def mock_db_with_result():
        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_db_result)
        yield db

    app.dependency_overrides[get_db] = mock_db_with_result

    resp = client.post("/chat", json={"text": "这个月花了多少"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "nl_result"
    assert "2350" in data["content"]
```

- [ ] **Step 2：运行更新后的测试，确认失败**

```bash
cd apps/backend && uv run pytest tests/test_chat_router.py -v
```

期望输出：部分或全部 FAILED（因为 chat.py 还未更新，`get_current_user` 依赖未被注册）

- [ ] **Step 3：完整替换 `apps/backend/routers/chat.py`**

```python
import re
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from infra.database import get_db
from infra.security import get_current_user
from schemas.chat import (
    ChatBillData,
    ChatNlData,
    ChatRequest,
    ChatResponse,
    ChatTextData,
)
from schemas.ocr import Transaction
from services.silicon import (
    chat_reply,
    classify_intent,
    extract_bill,
    generate_sql,
    summarize_result,
)
from services.tencent import recognize_speech

log = structlog.get_logger()

router = APIRouter(prefix="/chat", tags=["chat"])


def is_safe_sql(sql: str) -> bool:
    stripped = sql.strip().upper()
    return stripped.startswith("SELECT") and not any(
        re.search(rf"\b{kw}\b", stripped)
        for kw in ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE"]
    )


@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    current_user_id: Annotated[str, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        asr_text: str | None = None

        if body.audioBase64:
            asr_text = recognize_speech(audio_base64=body.audioBase64)
            if not asr_text:
                return ChatResponse(data=ChatTextData(content="没听清，要不再说一次？"))
            text_input = asr_text
        else:
            assert body.text is not None, "文本输入不能为空"
            text_input = body.text

        intent = await classify_intent(text_input)
        log.info("chat.intent", intent=intent, has_audio=body.audioBase64 is not None)

        if intent == "record":
            bill = await extract_bill(text_input)
            if bill:
                transaction = Transaction(
                    amount=float(bill["amount"]),
                    category=str(bill.get("category", "其他支出")),
                    note=bill.get("note") or "",
                    type="income" if bill.get("type") == "income" else "expense",
                    occurred_at=bill.get("occurred_at", ""),
                )
                return ChatResponse(
                    data=ChatBillData(transaction=transaction, asrText=asr_text)
                )
            else:
                return ChatResponse(
                    data=ChatTextData(
                        content="没解析到账单信息，可以试试「手动记账」。",
                        asrText=asr_text,
                    )
                )
        elif intent == "query":
            sql_query = await generate_sql(text_input)
            if not is_safe_sql(sql_query):
                return ChatResponse(
                    data=ChatTextData(
                        content="查询失败，请换个说法。", asrText=asr_text
                    )
                )

            sql_query = re.sub(
                r"WHERE\s+",
                f"WHERE transactions.user_id = '{current_user_id}' AND ",
                sql_query,
                count=1,
                flags=re.IGNORECASE,
            )

            try:
                result = await db.execute(sql_text(sql_query))
                query_result = [dict(row) for row in result.mappings().all()]
            except Exception:
                return ChatResponse(
                    data=ChatTextData(
                        content="查询出错，请换个方式描述。", asrText=asr_text
                    )
                )

            summary = await summarize_result(question=text_input, rows=query_result)
            return ChatResponse(data=ChatNlData(content=summary, asrText=asr_text))
        else:
            reply = await chat_reply(text_input)
            return ChatResponse(data=ChatTextData(content=reply, asrText=asr_text))
    except Exception:
        return ChatResponse(data=ChatTextData(content="处理失败，请稍后再试。"))
```

- [ ] **Step 4：运行 chat 测试，确认通过**

```bash
cd apps/backend && uv run pytest tests/test_chat_router.py -v
```

期望输出：全部 PASSED

- [ ] **Step 5：运行全量测试，确认无回归**

```bash
cd apps/backend && uv run pytest -v
```

期望输出：全部 PASSED

- [ ] **Step 6：从 `pyproject.toml` 移除旧依赖**

将 `dependencies` 改为（删除 `supabase` 和 `python-jose`）：

```toml
dependencies = [
    "asyncpg>=0.30.0",
    "fastapi>=0.135.3",
    "httpx>=0.28.1",
    "passlib[bcrypt]>=1.7.4",
    "pydantic-settings>=2.13.1",
    "PyJWT>=2.10.1",
    "sqlalchemy[asyncio]>=2.0.40",
    "structlog>=25.5.0",
    "tencentcloud-sdk-python>=3.1.70",
    "uvicorn[standard]>=0.42.0",
]
```

- [ ] **Step 7：同步依赖，再跑一次全量测试**

```bash
cd apps/backend && uv sync && uv run pytest -v
```

期望输出：全部 PASSED

- [ ] **Step 8：Commit**

```bash
git add apps/backend/routers/chat.py apps/backend/tests/test_chat_router.py \
        apps/backend/pyproject.toml apps/backend/uv.lock
git commit -m "feat(backend): 移除 Supabase，chat 路由改用 SQLAlchemy + JWT 认证"
```

---

## Task 7：替换前端 Supabase 认证

**Files:**

- Delete: `apps/mobile/lib/supabase.ts`
- Create: `apps/mobile/lib/auth.ts`
- Modify: `apps/mobile/lib/api.ts`
- Modify: `apps/mobile/hooks/useAuth.ts`
- Modify: `apps/mobile/app/_layout.tsx`
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/.env.example`

- [ ] **Step 1：更新 `apps/mobile/.env.example`**

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000
```

并更新你本地的 `apps/mobile/.env`，将 `EXPO_PUBLIC_API_URL` 设为你开发机的局域网 IP（用 `ifconfig | grep "inet "` 查看）。

- [ ] **Step 2：删除 `apps/mobile/lib/supabase.ts`**

- [ ] **Step 3：创建 `apps/mobile/lib/auth.ts`**

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_API_URL;
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

export async function register(email: string, password: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) {
    const data = await resp.json();
    throw new Error(data.detail ?? "Registration failed");
  }
}

export async function login(email: string, password: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) {
    const data = await resp.json();
    throw new Error(data.detail ?? "Login failed");
  }
  const { access_token, refresh_token } = await resp.json();
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, access_token);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  const resp = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!resp.ok) {
    await logout();
    return null;
  }
  const { access_token, refresh_token: newRefreshToken } = await resp.json();
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, access_token);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
  return access_token;
}
```

- [ ] **Step 4：更新 `apps/mobile/lib/api.ts`**

```typescript
import * as Localization from "expo-localization";

import { getAccessToken, refreshAccessToken } from "./auth";

const API_BASE = process.env.EXPO_PUBLIC_API_URL;

async function fetchWithToken<T>(
  token: string,
  path: string,
  options?: RequestInit,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Timezone": Localization.getCalendars()[0]?.timeZone ?? "Asia/Shanghai",
      ...options?.headers,
    },
  });
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  let response = await fetchWithToken(token, path, options);

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) throw new Error("Not authenticated");
    response = await fetchWithToken(newToken, path, options);
  }

  const json = await response.json();
  if (!response.ok) throw new Error(json?.error ?? `HTTP ${response.status}`);
  return json;
}
```

- [ ] **Step 5：改写 `apps/mobile/hooks/useAuth.ts`**

```typescript
import { useEffect, useState } from "react";

import { getAccessToken, login, logout, register } from "../lib/auth";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAccessToken().then((token) => {
      setIsAuthenticated(!!token);
      setLoading(false);
    });
  }, []);

  const signIn = async (email: string, password: string) => {
    await login(email, password);
    setIsAuthenticated(true);
  };

  const signUp = async (email: string, password: string) => {
    await register(email, password);
  };

  const signOut = async () => {
    await logout();
    setIsAuthenticated(false);
  };

  return { isAuthenticated, loading, signIn, signUp, signOut };
}
```

- [ ] **Step 6：更新 `apps/mobile/app/_layout.tsx`**

将第 38 行：

```typescript
const { session, loading } = useAuth();
```

改为：

```typescript
const { isAuthenticated, loading } = useAuth();
```

将第 62 行：

```typescript
if (!loading && !session) router.replace("/(auth)/login");
```

改为：

```typescript
if (!loading && !isAuthenticated) router.replace("/(auth)/login");
```

- [ ] **Step 7：从 `apps/mobile/package.json` 移除 `@supabase/supabase-js`**

在 `apps/mobile/package.json` 中找到并删除：

```json
"@supabase/supabase-js": "^2.99.1",
```

然后运行：

```bash
pnpm install
```

- [ ] **Step 8：验证 TypeScript 无报错**

```bash
cd apps/mobile && pnpm exec tsc --noEmit
```

期望输出：无错误（或只有与本次改动无关的既有 warning）

- [ ] **Step 9：Commit**

```bash
git add apps/mobile/lib/auth.ts apps/mobile/lib/api.ts \
        apps/mobile/hooks/useAuth.ts apps/mobile/app/_layout.tsx \
        apps/mobile/package.json apps/mobile/.env.example \
        pnpm-lock.yaml
git rm apps/mobile/lib/supabase.ts
git commit -m "feat(mobile): 移除 Supabase SDK，改用自建 JWT 认证 + AsyncStorage"
```

---

## 自检（Spec Coverage）

| 设计要求                                              | 对应 Task |
| ----------------------------------------------------- | --------- |
| Docker Compose 运行 PostgreSQL                        | Task 1    |
| `pnpm dev:all` 一条命令启动                           | Task 1    |
| Schema 去掉 RLS/auth.users                            | Task 2    |
| 新增 `users` 表                                       | Task 2    |
| 新增 PyJWT/passlib/sqlalchemy 依赖                    | Task 3    |
| 后端 `infra/` 目录重组                                | Task 4    |
| `/auth/register /auth/login /auth/refresh`            | Task 5    |
| access token (1h) + refresh token (30d)               | Task 5    |
| chat.py 移除 supabase，改用 get_current_user + get_db | Task 6    |
| 移除 supabase/python-jose 依赖                        | Task 6    |
| 前端 lib/auth.ts                                      | Task 7    |
| 前端 api.ts 401 自动 refresh                          | Task 7    |
| useAuth 改写                                          | Task 7    |
| \_layout.tsx session → isAuthenticated                | Task 7    |
| 删除 supabase.ts + supabase-js 依赖                   | Task 7    |

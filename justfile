# justfile — coco monorepo 任务管理

set shell := ["bash", "-cu"]
set unstable := true
set dotenv-load := true

backend := "apps/backend"
mobile := "mobile"
shared := "@coco/shared"

# ── 默认：列出所有 recipe ─────────────────────

test:
    @echo {{ os_family() }} # unix
    @echo {{ justfile() }}  # /Users/a114514/coco/.claude/worktrees/feat-pro/justfile
    @echo {{ justfile_directory() }} # /Users/a114514/coco/.claude/worktrees/feat-pro
    @echo {{ just_executable() }} # /opt/homebrew/bin/just
    @echo {{ arch() }} # aarch64
    @echo {{ os() }} # macos
    @echo {{ num_cpus() }} # 8
    @echo {{ lowercase('YZB') }} # yzb
    @echo {{ uppercase('yzb') }} # YZB
    @echo {{ env_var('DATABASE_URL') }}  # 111
    @echo {{ env_var_or_default('DATABASE_URL1', '123123') }}  # 123123

# ── 环境配置（worktree .env 软链接）──────────

# 前端 .env 软链接
env-fe:
    #!/usr/bin/env bash
    MAIN=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
    if [ "$MAIN" != "$(pwd)" ]; then
        ln -sfn "$MAIN/apps/mobile/.env" apps/mobile/.env
        echo '✅ mobile .env → main'
    else
        echo 'ℹ️  跳过: 非 worktree'
    fi

# 后端 .env 软链接
env-be:
    #!/usr/bin/env bash
    MAIN=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
    if [ "$MAIN" != "$(pwd)" ]; then
        ln -sfn "$MAIN/{{ backend }}/.env" {{ backend }}/.env
        echo '✅ backend .env → main'
    else
        echo 'ℹ️  跳过: 非 worktree'
    fi

# 全部 .env 软链接
env: env-fe env-be

# ── 依赖同步 ──────────────────────────────────
sync-fe:
    pnpm install

sync-be:
    cd {{ backend }} && uv sync

sync: sync-fe sync-be

# ── 开发服务器 ────────────────────────────────
start-fe: env-fe sync-fe
    pnpm --filter {{ mobile }} dev

start-be: env-be sync-be 
    cd {{ backend }} && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000



# ── CI/CD ─────────────────────────────────────
cicd-fe:
    pnpm --filter {{ mobile }} lint
    pnpm --filter {{ mobile }} format:check
    pnpm --filter {{ mobile }} typecheck
    pnpm --filter {{ shared }} lint
    pnpm --filter {{ mobile }} test
cicd-be:
    #!/usr/bin/env bash
    cd {{ backend }} && \
    uv run ruff check . && \
    uv run ruff format --check . && \
    uv run pyright && \
    SILICON_API_KEY=test \
    TENCENT_SECRET_ID=test \
    TENCENT_SECRET_KEY=test \
    DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test \
    JWT_SECRET=test \
    uv run pytest -x -q

cicd: cicd-be cicd-fe

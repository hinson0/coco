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
    #!/usr/bin/env bash
    PORT=8081
    while lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; do
        PORT=$((PORT + 1))
    done
    APP_JSON="apps/mobile/app.json"
    # 在 name 尾部追加 " :PORT"（不把中文存入变量，避免编码问题）
    sed -i '' 's/\("name": ".*\)"/\1 :'"$PORT"'"/' "$APP_JSON"
    cleanup() {
        sed -i '' "s/ :$PORT\"/\"/" "$APP_JSON"
        printf "♻️  app.json name 已还原\n"
    }
    trap cleanup EXIT
    printf "🚀 Expo → 端口 %d\n" "$PORT"
    pnpm --filter {{ mobile }} exec expo start --port "$PORT"

start-be: env-be sync-be
    #!/usr/bin/env bash
    PORT=8000
    PIDS=$(lsof -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        printf "❌ 端口 %d 已被占用，后端拒绝启动（端口是契约，不漂移）\n\n" "$PORT"
        printf "占用进程：\n"
        lsof -iTCP:"$PORT" -sTCP:LISTEN -n -P
        printf "\n处理方式：\n"
        printf "  • 若是旧后端：kill %s\n" "$(echo "$PIDS" | tr '\n' ' ')"
        printf "  • 若是其他进程：自行处置后重试\n"
        exit 1
    fi
    echo "🚀 启动后端 → 0.0.0.0:$PORT"
    cd {{ backend }} && uv run uvicorn main:app --reload --host 0.0.0.0 --port "$PORT"




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

# ── 知识库查询 ────────────────────────────────

knowledges_dir := env_var('HOME') + "/coco/docs/knowledges"
pdfs_dir := env_var('HOME') + "/coco/docs/pdfs"


# 显示所有 PDF 文件
show:
    @echo "📁 {{knowledges_dir}}"; \
     find {{knowledges_dir}} -type f -name "*.pdf" | sort
# 将 knowledges 下所有 PDF 移动到 pdfs/当日/，同名 .md 后缀改为 .printed.md
# 不传参 = pdfs/2026-04-21/；传 2 = pdfs/2026-04-21_2/（支持同一天多次运行）
# PDF 同名冲突时自动加后缀 _2、_3...
mv suffix="":
    #!/usr/bin/env bash
    today=$(date +%Y-%m-%d)
    if [ -z "{{suffix}}" ]; then
        dest_dir="{{pdfs_dir}}/$today"
    else
        dest_dir="{{pdfs_dir}}/${today}_{{suffix}}"
    fi
    mkdir -p "$dest_dir"
    echo "📁 $dest_dir"
    count=0
    while IFS= read -r f; do
        fname=$(basename "$f")
        target="$dest_dir/$fname"
        if [ -e "$target" ]; then
            base="${fname%.pdf}"
            n=2
            while [ -e "$dest_dir/${base}_${n}.pdf" ]; do
                n=$((n + 1))
            done
            target="$dest_dir/${base}_${n}.pdf"
            echo "⚠️  $fname 冲突 → 重命名为 $(basename "$target")"
        fi
        mv "$f" "$target"
        md="${f%.pdf}.md"
        if [ -f "$md" ]; then
            mv "$md" "${md%.md}.printed.md"
            echo "✅ $(basename "$target")  +  ${fname%.pdf}.md 标记 .printed.md"
        else
            echo "✅ $(basename "$target")（未找到同名 .md）"
        fi
        count=$((count + 1))
    done < <(find "{{knowledges_dir}}" -type f -name "*.pdf")
    if [ "$count" -eq 0 ]; then
        echo "ℹ️  knowledges 下没有 PDF"
    else
        echo ""
        echo "✅ 共移动 $count 个 PDF → $dest_dir"
    fi

# ── Docker 运维 ───────────────────────────────

# 备份 PostgreSQL 到 backups/ 目录（需 docker compose 已启动）
db-backup:
    #!/usr/bin/env bash
    set -e
    mkdir -p backups
    TS=$(date +%Y%m%d_%H%M%S)
    FILE="backups/coco_${TS}.sql"
    trap 'rm -f "$FILE"' ERR
    docker compose exec -T db pg_dump -U coco coco > "$FILE"
    trap - ERR
    SIZE=$(wc -c < "$FILE")
    if [ "$SIZE" -lt 100 ]; then
        rm -f "$FILE"
        echo "❌ 备份失败（文件为空），请确认 docker compose 已启动"
        exit 1
    fi
    echo "✅ 备份完成: $FILE ($(du -sh "$FILE" | cut -f1))"

# 从最新备份恢复（危险！会覆盖当前数据库）
db-restore:
    #!/usr/bin/env bash
    set -e
    if [ ! -t 0 ]; then
        echo "❌ db-restore 必须在交互式终端执行"
        exit 1
    fi
    LATEST=$(ls -t backups/coco_*.sql 2>/dev/null | head -1)
    if [ -z "$LATEST" ]; then
        echo "❌ backups/ 下没有找到备份文件"
        exit 1
    fi
    echo "⚠️  将从 $LATEST 恢复，当前数据会被覆盖"
    read -r -p "确认继续？(yes/N): " confirm
    if [ "$confirm" != "yes" ]; then echo "已取消"; exit 0; fi
    docker compose exec -T db psql -U coco -d coco -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    docker compose exec -T db psql -U coco -d coco < "$LATEST"
    echo "✅ 恢复完成"

# 安全重启：先备份再 down + up（替代直接 docker compose down && up）
safe-restart:
    just db-backup
    docker compose down
    docker compose up -d
    echo "✅ 安全重启完成（备份已保存到 backups/）"

# 查看所有备份文件
db-backups:
    @ls -lh backups/coco_*.sql 2>/dev/null || echo "暂无备份"


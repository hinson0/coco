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
    while lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; do
        NEXT=$((PORT + 1))
        printf "⚠️  端口 %d 已被占用，使用 %d? [Y/n] " "$PORT" "$NEXT"
        read -r ans
        if [[ "$ans" =~ ^[Nn]$ ]]; then
            echo "已取消"
            exit 1
        fi
        PORT=$NEXT
    done
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

# 查看知识文件（默认今天，传 1=昨天，2=前天，以此类推）
# kb: knowledge base知识库
show days="+0":
    @target=$(date -v{{days}}d +%Y-%m-%d); \
     next=$(date -v{{days}}d -v+1d +%Y-%m-%d); \
     echo "📅 $target"; \
     find {{knowledges_dir}} -name "*.md" -newerBt "$target 00:00:00" ! -newerBt "$next 00:00:00"

mv days="+0":
    #!/usr/bin/env bash
    target=$(date -v{{days}}d +%Y-%m-%d)
    next=$(date -v{{days}}d -v+1d +%Y-%m-%d)
    dest_dir="{{pdfs_dir}}/$target"
    mkdir -p "$dest_dir"
    echo "📁 $dest_dir"
    count=0
    while IFS= read -r f; do
        fname=$(basename "$f")
        cp "$f" "$dest_dir/$fname"
        mv "$f" "${f%.md}.printed.md"
        echo "✅ $fname → pdfs/$target/$fname"
        count=$((count + 1))
    done < <(find "{{knowledges_dir}}" -name "*.md" ! -name "*.printed.md" \
        -newerBt "$target 00:00:00" ! -newerBt "$next 00:00:00")
    if [ "$count" -eq 0 ]; then
        echo "ℹ️  $target 没有新文件"
    else
        echo ""
        echo "📄 请打开 $dest_dir 手动将 .md 转为 PDF"
    fi

# 镜像指定天的 .md 到 ~/kbs_pdf/kbs/，并把源文件标记为 .printed.md（默认今天，-1=昨天，以此类推）
# 废弃 2026-04-17
_pr days="+0":
    #!/usr/bin/env bash
    target=$(date -v{{days}}d +%Y-%m-%d)
    next=$(date -v{{days}}d -v+1d +%Y-%m-%d)
    src="$HOME/coco/docs/knowledges"
    echo "📅 $target"
    find "$src" -name "*.md" ! -name "*.printed.md" \
        -newerBt "$target 00:00:00" ! -newerBt "$next 00:00:00" | while read -r f; do
        rel="${f#$src/}"
        dest="$HOME/kbs_pdf/kbs/$rel"
        mkdir -p "$(dirname "$dest")"
        cp "$f" "$dest"
        mv "$f" "${f%.md}.printed.md"
        echo "✅ $rel  →  ~/kbs_pdf/kbs/$rel  +  原文件标记 .printed.md"
    done

# 还原：.printed.md → .md 并删除 ~/kbs_pdf/kbs/ 中的副本（默认今天，-1=昨天，以此类推）
# 废弃 2026-04-17
_pr-reset days="+0":
    #!/usr/bin/env bash
    target=$(date -v{{days}}d +%Y-%m-%d)
    next=$(date -v{{days}}d -v+1d +%Y-%m-%d)
    src="$HOME/coco/docs/knowledges"
    echo "↩️  还原日期：$target"
    find "$src" -name "*.printed.md" \
        -newerBt "$target 00:00:00" ! -newerBt "$next 00:00:00" | while read -r f; do
        orig="${f%.printed.md}.md"
        rel="${orig#$src/}"
        mv "$f" "$orig"
        rm -f "$HOME/kbs_pdf/kbs/$rel"
        echo "↩️  $rel 已还原，~/kbs_pdf/kbs/$rel 已删除"
    done

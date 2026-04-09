default:
    @just --list

# 帮助 `just help`
help:
    @echo "\n***所有命令必须在仓库根目录执行,即含有justfile文件的目录***\n"
    @just --list

# 同步所有依赖
sync:
    pnpm install
    cd apps/backend && uv sync

# 同步worktree: 软连接.env到worktree + 安装依赖
sync-w name:
    ln -sf "{{ justfile_directory() }}/apps/backend/.env" "{{ justfile_directory() }}/.claude/worktrees/{{ name }}/apps/backend/.env"
    ln -sf "{{ justfile_directory() }}/apps/mobile/.env" "{{ justfile_directory() }}/.claude/worktrees/{{ name }}/apps/mobile/.env"
    cd "{{ justfile_directory() }}/.claude/worktrees/{{ name }}" && pnpm install
    cd "{{ justfile_directory() }}/.claude/worktrees/{{name}}/apps/backend" && uv sync

# 启动基础设施+前后端开发服务器
dev:
    docker compose up -d
    npx concurrently -n backend,frontend -c blue,green \
        "cd apps/backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000" \
        "pnpm --filter mobile dev"

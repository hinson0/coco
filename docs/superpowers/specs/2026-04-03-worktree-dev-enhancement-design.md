# Worktree Dev 脚本增强设计

## 背景

现有 `scripts/worktree-dev.mjs` 只处理 mobile 前端（pnpm install + pnpm dev）。使用 worktree 开发时存在三个痛点：

1. `.env` 文件（`apps/backend/.env`、`apps/mobile/.env`）被 gitignore，新 worktree 需要手动 copy
2. 每次新建 worktree 需要手动跑 `uv sync`（backend）
3. 启动需要两个终端分别执行 uvicorn 和 pnpm dev，backend 端口还要手动指定

## 目标

一个命令搞定 worktree 的全部启动流程：`.env` 自动就绪 + 依赖自动安装 + 前后端并发启动。

## CLI 接口

```bash
pnpm worktree <name> [--port <backendPort>]
```

- `<name>`：worktree 名称，对应 `.claude/worktrees/<name>/`
- `--port`：backend 端口，默认 `8000`
- frontend 端口 = backendPort + 80（固定约定，无需单独指定）

示例：
```bash
pnpm worktree feat-infra            # backend 8000, frontend 8080
pnpm worktree feat-infra --port 8001 # backend 8001, frontend 8081
```

## 设计

### 1. Env 符号链接（新增）

脚本从 repo 根目录执行（`process.cwd()`），自动创建指向 main repo env 文件的绝对路径 symlink：

| worktree 内 | symlink 目标 |
|---|---|
| `<worktree>/apps/backend/.env` | `<cwd>/apps/backend/.env` |
| `<worktree>/apps/mobile/.env` | `<cwd>/apps/mobile/.env` |

规则：
- symlink 已存在 → 跳过（幂等）
- target 文件存在 → `fs.symlinkSync(target, linkPath)`
- target 文件不存在 → 打印警告，不阻断启动

好处：main repo 修改 `.env` 后，所有 worktree 自动看到最新值。

### 2. 依赖安装（增强现有逻辑）

| 条件 | 操作 |
|---|---|
| `<worktree>/node_modules` 不存在 | `pnpm install`（已有） |
| `<worktree>/apps/backend/.venv` 不存在 | `uv sync`（新增，在 `apps/backend/` 目录下执行） |

两步均幂等，重复运行安全。

### 3. 并发启动（重构现有逻辑）

用 Node.js 原生 `child_process.spawn` 同时起两个进程：

- **backend**：`uvicorn main:app --reload --host 0.0.0.0 --port <backendPort>`，cwd 为 `<worktree>/apps/backend/`
- **frontend**：`pnpm --filter <wtName> dev --port <frontendPort>`，cwd 为 `<worktree>/`

输出处理：
- 每行 stdout/stderr 加前缀 `[backend] ` 或 `[mobile] ` 区分来源
- 颜色：backend 用青色，mobile 用绿色（使用 ANSI 转义码，无额外依赖）

信号处理：
- `SIGINT` / `SIGTERM` → kill 两个进程 → 恢复 mobile `package.json` / `app.json`（现有逻辑保留）
- 任意进程意外退出 → 打印退出提示，另一个进程继续运行

## 文件变更

| 文件 | 变更类型 |
|---|---|
| `scripts/worktree-dev.mjs` | 修改（全量重写，保留现有 mobile name 逻辑） |

不新增依赖，不新增文件。

## 不在范围内

- docker-compose 支持
- 多 worktree 同时启动的端口自动分配
- `.env` 目录结构重组（保持现有 main repo env 文件位置不变）

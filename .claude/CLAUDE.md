# 项目结构

Monorepo (pnpm workspace)：

- `apps/mobile` — Expo React Native 移动端（主应用）
- `apps/backend` — Python FastAPI 后端（ASR、OCR、文本记账），包管理用 `uv`
- `packages/shared` — 共享类型、规则引擎（`parse()`）
- `supabase/migrations/` — 数据库 schema（Supabase PostgreSQL）

# 常用命令

- `pnpm dev` — 启动 Expo 开发服务器（等价于 `pnpm --filter mobile dev`）
- `pnpm worktree` — worktree 开发模式
- `docker compose up` — 启动本地 FastAPI 后端
- `uv add <pkg>` — 后端添加 Python 依赖（在 `apps/backend/` 下执行）

# Git 工作流（必须遵守）

## 禁止直接推送 main

- **严禁** `git push origin xxx:main`，任何情况都不允许直接推送到 main
- push 时只推到当前分支：`git push origin HEAD` 或 `git push -u origin <branch-name>`
- 合并到 main 必须通过 PR：`gh pr create` → review → merge

# 协作模式（必须遵守）

## Learning 模式下的分工

当 Learning 模式开启时：

- **前端代码**：至少 30% 由用户亲自编写，Claude 负责剩余 70%（框架、样板、复杂逻辑）
- **后端 Python 代码**：100% 由用户亲自编写，Claude 只提供指导、解释和审查，不直接写 Python 代码
- **目录结构变更**：100% 由用户亲自创建（`mkdir` 等），Claude 不得主动创建目录或文件结构，只告知应该创建什么、为什么

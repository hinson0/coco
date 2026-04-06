# 项目结构

Monorepo (pnpm workspace)：

- `apps/mobile` — Expo React Native 移动端（主应用）
- `apps/backend` — Python FastAPI 后端（ASR、OCR、文本记账），包管理用 `uv`
- `packages/shared` — 共享类型、规则引擎（`parse()`）
- `supabase/migrations/` — 数据库 schema（Supabase PostgreSQL）

# 常用命令

- `pnpm dev` — 启动 Expo 开发服务器（等价于 `pnpm --filter mobile dev`）
- `pnpm worktree` — worktree 开发模式
- `uv add <pkg>` — 后端添加 Python 依赖（在 `apps/backend/` 下执行）

# Git 工作流（必须遵守）

## 禁止直接推送 main

- **严禁** `git push origin xxx:main`，任何情况都不允许直接推送到 main
- push 时只推到当前分支：`git push origin HEAD` 或 `git push -u origin <branch-name>`
- 合并到 main 必须通过 PR：`gh pr create` → review → merge

# 开发流程（必须遵守）

## 完整流程

每次功能开发必须走完整流程，**不得跳过任何步骤**：

```
brainstorming → writing-plans → executing-plans
  ↓ (每个 Task 内)
  TDD：先写测试，再写实现
  ↓ (全部 Task 完成后)
  superpowers:requesting-code-review
  ↓
  finishing-a-development-branch
```

## 测试基础设施缺失时

项目目前**没有**测试框架（无 pytest 配置、无 `tests/` 目录、无 jest）。
若开始新功能，第一个 Task 必须先搭测试环境，再写业务代码。

## 禁止遗漏的步骤

- `executing-plans` 全部 Task 完成后，**必须**调用 `superpowers:requesting-code-review`
- Learning 模式不是跳过 code review 和测试的理由

# 协作模式（必须遵守）

## Learning 模式下的分工

当 Learning 模式开启时：

- **目录结构变更**：100% 由用户亲自创建（`mkdir` 等），Claude 不创建目录或文件结构
- **代码编写（前后端统一）**：
  1. Claude 把完整代码输出到对话
  2. 用户 review，说 OK 后自己在编辑器里输入
  3. 用户说 review → Claude 审查实际文件

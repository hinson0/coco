# CI/CD Pipeline — 前后端代码质量自动检查

## Problem Statement

个人开发者在 monorepo 中维护前端（Expo React Native）和后端（Python FastAPI），目前完全依赖本地 VSCode 插件做代码格式化和检查，没有任何自动化 CI 流程。导致代码质量不一致、手动测试容易遗漏、PR 合并缺乏质量门禁。

## Evidence

- 项目当前无 `.github/workflows` 目录，零 CI/CD 配置
- 后端缺少 linter 和 formatter（无 ruff/black）
- 前端有 ESLint + Prettier 配置但 package.json 缺少对应 scripts
- 仅靠 VSCode 插件做格式化，换环境或忘记安装插件时无保障

## Proposed Solution

基于 GitHub Actions 构建 CI 流水线，在 PR 创建/更新时自动运行 lint、format check、type check 和测试，未通过则阻止合并。前端使用 ESLint + Prettier + TypeScript + Jest，后端引入 ruff（lint + format）+ Pyright + Pytest。

## Key Hypothesis

我们相信 **自动化代码质量检查** 将 **消除代码质量不一致和手动检查遗漏** 对 **个人开发者** 的影响。
我们会在 **PR 合并前所有检查自动通过、零手动干预** 时确认成功。

## What We're NOT Building

- 自动部署（CD）— 当前阶段不需要
- 移动端 APK/IPA 自动构建 — 复杂度高，后续单独做
- Docker 镜像构建 — 后续按需
- 代码覆盖率报告 — 可在后续迭代添加

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| PR 检查自动运行率 | 100% PR 触发 CI | GitHub Actions 运行记录 |
| 检查通过才能合并 | branch protection 启用 | GitHub 仓库设置 |
| CI 运行时间 | < 5 分钟 | GitHub Actions 耗时 |

## Open Questions

- [ ] 后端 pytest 是否需要数据库（需要 PostgreSQL service 容器？）
- [ ] 是否需要缓存 pnpm/uv 依赖加速 CI
- [ ] 是否需要设置 branch protection rules（需仓库 admin 权限）

---

## Users & Context

**Primary User**
- **Who**: 个人开发者（项目唯一维护者）
- **Current behavior**: 本地用 VSCode 插件做格式化，手动运行测试
- **Trigger**: 创建 PR 准备合并代码时
- **Success state**: PR 页面显示所有检查通过的绿色勾

**Job to Be Done**
当 **提交 PR 准备合并代码** 时，我想要 **自动检查代码质量和运行测试**，以便 **确保合并的代码质量一致、没有低级错误**。

**Non-Users**
此 CI 不面向外部贡献者（个人项目），不需要考虑多环境矩阵。

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | 前端 ESLint 检查 | 捕获代码质量和潜在 bug |
| Must | 前端 Prettier format check | 保证代码风格一致 |
| Must | 前端 TypeScript 类型检查 | 捕获类型错误 |
| Must | 前端 Jest 单元测试 | 验证业务逻辑正确性 |
| Must | 后端 ruff lint + format check | Python 代码质量和格式一致性 |
| Must | 后端 Pyright 类型检查 | 捕获 Python 类型错误 |
| Must | 后端 Pytest 测试 | 验证后端逻辑正确性 |
| Should | pnpm/uv 依赖缓存 | 加速 CI 运行 |
| Could | Branch protection rules | 强制 CI 通过才能合并 |
| Won't | 自动部署 | 明确延后 |

### MVP Scope

两个 GitHub Actions workflow 文件：
1. `frontend.yml` — 前端 lint + format + typecheck + test
2. `backend.yml` — 后端 ruff + pyright + pytest

触发条件：PR 到 main 分支时。

### User Flow

```
开发者 push 代码 → 创建 PR → GitHub Actions 自动触发
  → 前端 workflow: install → lint → format check → typecheck → test
  → 后端 workflow: install → ruff check → ruff format check → pyright → pytest
→ 全部通过 → PR 页面显示绿色 ✅ → 可以合并
→ 任一失败 → PR 页面显示红色 ❌ → 修复后重新触发
```

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- 前后端分开两个 workflow，互不阻塞，可并行运行
- 前端需要在 package.json 补充 lint/format/typecheck scripts
- 后端需要在 pyproject.toml 添加 ruff 为 dev 依赖并配置
- 使用 pnpm 官方 action 安装依赖，uv 官方 action 安装 Python 依赖

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| better-sqlite3 源码编译在 CI 失败 | M | 使用 ubuntu-latest，需 build-essential |
| 后端测试需要数据库连接 | M | 第一版跳过需要 DB 的测试，或加 PostgreSQL service |
| ruff 规则与现有代码冲突多 | L | 初始配置宽松，逐步收紧 |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | 前端工具链补全 | 补充 lint/format/typecheck scripts | pending | with 2 | - | - |
| 2 | 后端工具链补全 | 引入 ruff，配置 lint + format | pending | with 1 | - | - |
| 3 | GitHub Actions 前端 CI | 创建 frontend workflow | pending | with 4 | 1 | - |
| 4 | GitHub Actions 后端 CI | 创建 backend workflow | pending | with 3 | 2 | - |
| 5 | 验证与调优 | 实际 PR 测试，修复问题 | pending | - | 3, 4 | - |

### Phase Details

**Phase 1: 前端工具链补全**
- **Goal**: 让前端项目有可运行的 lint/format/typecheck 命令
- **Scope**: 在 apps/mobile/package.json 添加 scripts；确认 ESLint、Prettier、TSC 能正常运行
- **Success signal**: `pnpm --filter mobile lint` / `format:check` / `typecheck` 各命令可在本地成功运行

**Phase 2: 后端工具链补全**
- **Goal**: 后端引入 ruff 作为 linter + formatter
- **Scope**: 在 pyproject.toml 添加 ruff 为 dev 依赖，配置 ruff rules，确认可运行
- **Success signal**: `uv run ruff check .` 和 `uv run ruff format --check .` 可在本地成功运行

**Phase 3: GitHub Actions 前端 CI**
- **Goal**: PR 时自动运行前端质量检查
- **Scope**: 创建 `.github/workflows/frontend.yml`
- **Success signal**: PR 创建后 GitHub 自动运行前端检查

**Phase 4: GitHub Actions 后端 CI**
- **Goal**: PR 时自动运行后端质量检查
- **Scope**: 创建 `.github/workflows/backend.yml`
- **Success signal**: PR 创建后 GitHub 自动运行后端检查

**Phase 5: 验证与调优**
- **Goal**: 确保 CI 在真实 PR 中正常工作
- **Scope**: 创建测试 PR 验证，调优失败项，启用 branch protection
- **Success signal**: 端到端 PR 流程顺畅，CI 5 分钟内完成

### Parallelism Notes

Phase 1 和 2 可并行（前后端工具链独立）。Phase 3 和 4 可并行（两个 workflow 文件独立）。Phase 5 需等 3、4 都完成。

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Python linter | ruff | flake8, pylint | 速度极快，同时覆盖 lint + format，一个工具搞定 |
| CI 平台 | GitHub Actions | GitLab CI, CircleCI | 项目已在 GitHub，免费额度充足 |
| Workflow 拆分 | 前后端分开 | 单一 workflow | 互不阻塞，并行运行，失败定位清晰 |
| 触发条件 | PR to main | push to any branch | 个人项目只需 PR 时检查，避免不必要的运行 |

---

## Research Summary

**Market Context**
- GitHub Actions 是个人/小团队 CI/CD 的主流选择，免费额度 2000 分钟/月
- ruff 已成为 Python 社区最流行的 linter，性能比 flake8 快 10-100 倍
- pnpm 和 uv 都有官方 GitHub Actions setup action

**Technical Context**
- 前端工具链（ESLint + Prettier + TS）配置已存在，只缺 scripts
- 后端需要新增 ruff 依赖和配置
- monorepo 结构适合分 workflow 运行，paths filter 可减少不必要触发

---

*Generated: 2026-04-12*
*Status: DRAFT - needs validation*

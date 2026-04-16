# 项目结构

Monorepo (pnpm workspace)：

- `apps/mobile` — Expo React Native 移动端（主应用）
- `apps/backend` — Python FastAPI 后端（ASR、OCR、文本记账），包管理用 `uv`
- `packages/shared` — 共享类型、规则引擎（`parse()`）
- `apps/backend/alembic/` — 数据库迁移（Alembic + PostgreSQL）
- `docs/` — 插件工作流产出文档（详见「插件产出物路径」章节）

# 常用命令

- `pnpm dev` — 启动 Expo 开发服务器（等价于 `pnpm --filter mobile dev`）
- `uv add <pkg>` — 后端添加 Python 依赖（在 `apps/backend/` 下执行）

# Git 工作流（必须遵守）

## Commit Message 语言

- commit message 和 PR title/body 统一使用**中文**描述，type 前缀保持英文（如 `feat:` `fix:` `docs:`）
- 示例：`feat(backend): 引入 Alembic 数据库迁移`

## 禁止直接推送 main

- **严禁** `git push origin xxx:main`，任何情况都不允许直接推送到 main
- push 时只推到当前分支：`git push origin HEAD` 或 `git push -u origin <branch-name>`
- 如果在main执行了commit/push/pr等命令,必须询问用户是否,使用`AskUserQuestion`工具,得到明确的答复执行.

# 插件产出物路径（必须遵守）

不同 Claude Code 插件的工作流文档，统一存放在**仓库根目录** `docs/<插件名>/` 下：

| 插件 | 根目录 | 子目录 |
|------|--------|--------|
| **Superpowers**（当前使用） | `docs/superpowers/` | `brainstorm/`、`plans/`、`specs/` |
| **ECC** (everything-claude-code) | `docs/ecc/` | `prds/`、`plans/`、`reports/` |

规则：**哪个插件生成的文档就放到对应的 `docs/<插件名>/` 目录下**，不要混放。如果未来使用新插件，同理新建 `docs/<新插件名>/`。

# UI 规范（必须遵守）

## 多行文本输入框键盘

所有 `multiline` 的 `TextInput`（如备注输入框）必须设置：

- `returnKeyType="default"` — 键盘显示"换行"而非"完成"
- `blurOnSubmit={false}` — 按回车键换行而非提交/关闭键盘

# 不用处理:

apps/mobile/app.json 名称被改为 CoCo AI记账 <端口> 如果是这个问题是否要修复/提交,则无视,
因为这个是expo go调试用的.直接忽略

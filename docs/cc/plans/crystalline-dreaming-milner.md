# 计划：优化知识点落盘规则 & 重组现有文件

## Context

当前 `~/.claude/CLAUDE.md` 中的知识点落盘规则只有两行，描述模糊。现有 10 个知识文件全部平铺在 `docs/knowledges/` 下，没有按主题分目录，随着知识积累会越来越混乱。

用户希望：所有知识点统一按 `<主题>/` 子目录组织，如 `fastapi/`、`python/`、`ecc/` 等。

## 修改内容

### 1. 更新 `~/.claude/CLAUDE.md` 的知识点规则

将现有的：
```
## 知识点的落盘
- 所有的知识点落盘路径在 ~/coco/docs/knowledges/<主题>/<内容简要>.md
比如,关于fastapi的middlware就是 fastapi/middleware_xxxx.md
```

改为更清晰的版本，包含：
- 明确路径格式
- 主题目录命名规范（小写、用连字符）
- 几个示例
- 说明新建主题目录的规则

### 2. 重组现有 10 个文件到主题目录

当前文件 → 目标位置：

| 现有文件 | 目标路径 |
|---------|---------|
| `fastapi-middleware.md` | `fastapi/middleware.md` |
| `python-annotated.md` | `python/annotated.md` |
| `python-sh-library.md` | `python/sh-library.md` |
| `pnpm-workspace-guide.md` | `pnpm/workspace-guide.md` |
| `android-debug-setup.md` | `android/debug-setup.md` |
| `lww-upsert.md` | `database/lww-upsert.md` |
| `2026-04-02-monorepo-python-backend-notes.md` | `monorepo/python-backend-notes.md` |
| `ecc-plugin-architecture.md` | `ecc/plugin-architecture.md` |
| `ecc-prp.md` | `ecc/prp.md` |
| `ecc-skills-relevant.md` | `ecc/skills-relevant.md` |

## 验证

- 确认 `docs/knowledges/` 根目录下不再有 `.md` 文件
- 确认每个主题子目录下文件存在
- 确认 CLAUDE.md 规则已更新

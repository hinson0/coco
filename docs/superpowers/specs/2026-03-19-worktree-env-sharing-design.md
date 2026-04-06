# Worktree 自动共享 .env 文件

- **日期**: 2026-03-19
- **状态**: 已批准

## 问题

每次通过 `claude -w` 或 `git worktree add` 创建新 worktree 时，需要手动复制 `apps/mobile/.env` 和 `apps/api/.env.local`，流程繁琐且容易遗忘。

## 方案

将 env 源文件集中存放在主 worktree 的 `.env/` 目录下，各 app 目录通过 symlink 引用。新 worktree 创建时，Git `post-checkout` hook 自动创建 symlink。

## 文件结构

```
/Users/a114514/coco/                  ← 主 worktree
├── .env/                             ← env 源文件（已被 .gitignore 忽略）
│   ├── mobile.env                    ← 原 apps/mobile/.env
│   └── api.env.local                 ← 原 apps/api/.env.local
├── .githooks/
│   └── post-checkout                 ← 自动创建 symlink 的脚本
├── apps/mobile/.env                  → symlink → <主 worktree>/.env/mobile.env
└── apps/api/.env.local               → symlink → <主 worktree>/.env/api.env.local
```

## Env 文件映射

| 源文件（.env/ 下）  | Symlink 位置            | 框架    | 说明                           |
| ------------------- | ----------------------- | ------- | ------------------------------ |
| `mobile.env`        | `apps/mobile/.env`      | Expo    | `EXPO_PUBLIC_*` 前缀变量       |
| `api.env.local`     | `apps/api/.env.local`   | Next.js | `NEXT_PUBLIC_*` + 服务端密钥   |

两个文件值有部分重叠（Supabase URL/Key），但因框架前缀不同无法合并。

## post-checkout Hook 逻辑

**触发时机**: `git worktree add` 执行 checkout 时自动触发

**流程**:

1. 通过 `git rev-parse --path-format=absolute --git-common-dir` 获取主 worktree 路径
2. 如果当前目录 == 主 worktree → 跳过（主 worktree 已有 symlink）
3. 遍历 env 文件映射，对每个条目：
   - 源文件不存在 → 打印警告，**直接退出**
   - 目标已是 symlink → 跳过
   - 目标已是普通文件 → 打印警告："⚠ <路径> 正在使用手动配置，而非主 worktree 的共享配置"，跳过
   - 目标不存在 → 创建 symlink，打印 "✓ linked <路径>"

## Hook 启用方式

在根 `package.json` 的 `postinstall` 脚本中添加：

```
git config core.hooksPath .githooks
```

`pnpm install` 后自动生效，无需手动配置。

## 迁移步骤

1. 创建 `.env/` 目录
2. 移动 `apps/mobile/.env` → `.env/mobile.env`
3. 移动 `apps/api/.env.local` → `.env/api.env.local`
4. 在原位置创建 symlink 指向 `.env/` 下对应文件
5. 创建 `.githooks/post-checkout` 脚本
6. 在 `package.json` 的 `postinstall` 中配置 `core.hooksPath`
7. 验证 `pnpm dev` 正常工作

# 项目结构

Monorepo (pnpm workspace + turbo)：
- `apps/mobile` — Expo React Native 移动端（主应用）
- `packages/shared` — 共享类型、规则引擎（`parse()`）
- `packages/ai` — GLM 解析器
- `supabase/functions/` — Edge Functions（ASR、OCR、文本记账）

# 常用命令

- `pnpm dev` — 启动 Expo 开发服务器（等价于 `pnpm --filter mobile dev`）
- `pnpm worktree` — worktree 开发模式
- `npx supabase functions deploy <name>` — 部署 Edge Function
- `npx supabase secrets set KEY=VALUE` — 设置 Edge Function 环境变量

# 架构原则（最高优先级）

## 离线优先，零卡顿

所有用户操作必须即时响应，严禁出现因网络请求导致的 UI 阻塞或等待：

1. **本地先行**：所有数据变更（增删改）先写入本地 SQLite，UI 立即更新，用户感知零延迟
2. **后台同步**：Supabase 仅作为后台数据同步通道，所有与 Supabase 的交互（上传、拉取、认证相关的数据同步）均在后台静默执行，不阻塞主线程和用户交互
3. **失败静默重试**：同步失败时不弹错误提示打断用户，记录待同步队列，下次有网时自动重试
4. **启动时拉取**：App 启动或恢复前台时，后台拉取远端最新数据合并到本地，保证多设备一致性

简言之：**前端体验 = 纯本地 App 的流畅度，Supabase 是透明的后台同步层。**

## 手势回调中的异步操作

- PanResponder/手势回调中，UI 状态切换必须在 `await` 之前执行
- 先切状态（浮层立即出现/消失），再后台执行异步操作（录音启停、文件读写）
- 异步操作失败时回退状态即可

---

# 语言

## 回复语言（必须遵守）

全程使用**简体中文**回复，包括：
- 所有解释、提问、总结
- 内部 thinking/reasoning 过程
- 代码注释中的说明文字
- git commit message 的标题和正文
- PR 的标题和正文（Summary、Test Plan 等内容部分）

# Git 工作流（必须遵守）

## 禁止直接推送 main

- **严禁** `git push origin xxx:main`，任何情况都不允许直接推送到 main
- push 时只推到当前分支：`git push origin HEAD` 或 `git push -u origin <branch-name>`
- 合并到 main 必须通过 PR：`gh pr create` → review → merge

# 工作路径

## Plan Mode 文件位置

Claude Code Plan Mode 的计划文件保存在**当前项目目录内**：
`.claude/plans/YYYY_MM_DD_HH_mm-<name>.md`

注意：superpowers:writing-plans 遵循其自身默认路径（`docs/superpowers/plans/`），不受此规则影响。

# 代码风格

## React Query Hook 模式

- 查询 hook：`useQuery` + `queryKey` + `enabled: !!db` 守卫
- 变更 hook：独立导出的 `useMutation` 函数（useCreateX, useUpdateX, useDeleteX）
- 所有 mutation 在 `onSuccess` 中 `invalidateQueries`
- DB 操作用 `useOfflineContext()` 获取 SQLite 实例
- ID 生成用 `Crypto.randomUUID()`
- 类型导入统一从 `@coco/shared` 导入

## SQLite 约定

- 参数用位置占位符 `?`，通过 `db.runAsync(sql, ...params)` 传入
- 整数布尔字段读取时转换：`Boolean(r.is_default)`
- 软删除用 `deleted_at TEXT` 字段，查询时 `WHERE deleted_at IS NULL`
- Schema 迁移用 `PRAGMA table_info` 检测列是否存在后再 ALTER

## 页面/屏幕模式

- `useSafeAreaInsets()` 处理安全区
- 统一 Header 布局：返回按钮(←) | 标题 | 右侧操作/占位
- Header 背景统一用 `colors.cream`，不使用白色背景，不加底部分隔线
- 返回按钮统一样式：36x36 圆角白底带阴影（`borderRadius: radii.md, backgroundColor: colors.white, ...shadows.md`），箭头用 `<Text style={{ fontSize: 18, color: colors.text, lineHeight: 22 }}>←</Text>`
- 键盘处理：`Keyboard.addListener` 动态调整底部按钮位置
- 提交状态：`submitting` state + `ActivityIndicator` + disabled
- 导航用 `router.push()` / `router.back()`（expo-router）
- 保存按钮统一放在页面底部（跟随键盘高度），永远不放右上角
- 表单多字段跳转：Android 上 `returnKeyType="next"` 对部分输入法无效，用 `multiline` + `numberOfLines={1}` + `onChangeText` 拦截 `\n` 跳转下一字段
- 编辑页返回前必须 `await qc.invalidateQueries()` 确保列表页数据即时刷新

## Supabase Edge Functions

- 部署用 MCP tool `deploy_edge_function`，或 `npx supabase functions deploy <name>`
- `verify_jwt: false` — 新版 `sb_publishable_` key 格式与网关 JWT 验证不兼容
- 客户端调用必须带 `apikey` header（`EXPO_PUBLIC_SUPABASE_ANON_KEY`）
- 环境变量通过 `npx supabase secrets set KEY=VALUE` 设置，每个 key 单独一条命令避免换行问题
- 函数内不检查 Authorization header（网关已处理认证）

## 环境变量

- Expo 移动端用 `EXPO_PUBLIC_` 前缀，Next.js Web 用 `NEXT_PUBLIC_` 前缀
- 两者不互通，需在 `.env` 中分别声明

## 依赖安装

- 移动端依赖装在 `apps/mobile`：`pnpm add <pkg> --filter mobile`
- 共享包依赖装在对应 package 下，不要装在根目录


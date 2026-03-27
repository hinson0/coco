# 架构原则（最高优先级）

## 离线优先，零卡顿

所有用户操作必须即时响应，严禁出现因网络请求导致的 UI 阻塞或等待：

1. **本地先行**：所有数据变更（增删改）先写入本地 SQLite，UI 立即更新，用户感知零延迟
2. **后台同步**：Supabase 仅作为后台数据同步通道，所有与 Supabase 的交互（上传、拉取、认证相关的数据同步）均在后台静默执行，不阻塞主线程和用户交互
3. **失败静默重试**：同步失败时不弹错误提示打断用户，记录待同步队列，下次有网时自动重试
4. **启动时拉取**：App 启动或恢复前台时，后台拉取远端最新数据合并到本地，保证多设备一致性

简言之：**前端体验 = 纯本地 App 的流畅度，Supabase 是透明的后台同步层。**

---

# 语言

## 回复语言（必须遵守）

全程使用**简体中文**回复，包括：
- 所有解释、提问、总结
- 内部 thinking/reasoning 过程
- 代码注释中的说明文字

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
- 键盘处理：`Keyboard.addListener` 动态调整底部按钮位置
- 提交状态：`submitting` state + `ActivityIndicator` + disabled
- 导航用 `router.push()` / `router.back()`（expo-router）
- 保存按钮统一放在页面底部（跟随键盘高度），永远不放右上角
- 表单多字段跳转：Android 上 `returnKeyType="next"` 对部分输入法无效，用 `multiline` + `numberOfLines={1}` + `onChangeText` 拦截 `\n` 跳转下一字段
- 编辑页返回前必须 `await qc.invalidateQueries()` 确保列表页数据即时刷新


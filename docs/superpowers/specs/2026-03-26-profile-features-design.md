# "我的"页面功能完善 — 设计文档

> 日期：2026-03-26
> 范围：用户信息编辑、分类管理、预算设置扩展、我的账户

## 概述

将"我的"页面中的 mock/静态功能替换为真实数据驱动的完整功能。四个模块按优先级排序：

1. 用户信息编辑（头像 + 昵称）
2. 分类管理（自定义分类 CRUD）
3. 预算设置（按分类设预算 + 列表管理）
4. 我的账户（多账户余额追踪）

## 架构原则

- **离线优先，零卡顿**：所有数据变更先写入本地 SQLite，UI 即时更新。Supabase 仅作为后台静默同步通道，不阻塞用户交互。
- **每个模块独立数据层**：各自有独立的 SQLite 表 + React Query hook + 后台同步逻辑，和现有代码风格一致（`useLocalTransactions`、`useLocalBudgets` 各管各的）。
- **乐观更新（Optimistic UI）**：用户点保存 → 立即写本地 → UI 瞬间更新 → 后台静默同步 → 失败时静默排队重试。

---

## 模块一：用户信息编辑

### 数据模型

新建 `user_profiles` 表：

```sql
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  nickname TEXT,
  avatar_type TEXT NOT NULL DEFAULT 'emoji',
  avatar_value TEXT NOT NULL DEFAULT '🌿',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- `id` 和 Supabase auth user id 一致
- `avatar_type`：`'emoji'` | `'image'`，决定渲染方式（emoji 直接显示文字，image 用 `<Image>` 组件加载）
- `avatar_value`：emoji 字符 或 本地图片路径（远端同步时转换为 Supabase Storage URL）
- `nickname`：默认从 email `@` 前提取

### 数据层

`useLocalProfile` hook：

- `useProfile()` — 查询当前用户 profile
- `useUpdateProfile()` — 更新昵称/头像 → 写本地 → 触发后台同步
- `useInitProfile()` — App 启动时，若 profile 不存在则从 email 初始化一条

### 同步策略

- 本地先写 SQLite，UI 即时刷新
- 后台上传头像图片到 Supabase Storage（仅 `avatar_type = 'image'` 时），昵称通过 `auth.updateUser({ data: { nickname } })` 同步到 `user_metadata`
- App 启动时拉取远端 profile 合并到本地

### UI 交互

1. **"我的"页面**：顶部显示头像 + 昵称 + "已记账 X 天"，点击头像或昵称进入编辑页
2. **编辑页面** (`/profile-edit`)：
   - 点击头像区域 → 弹出底部选择器：「选择 Emoji」/「从相册选择」/「拍照」
   - 昵称输入框（20 字限制）
   - 顶部「保存」按钮 → 写入本地 → 返回上一页 → UI 即时刷新

### 头像方案

支持两种：
- **Emoji 头像**：从预设 emoji 列表中选择，体积小无需文件存储
- **图片上传**：从相册选择或拍照，裁剪后存本地 + 上传 Supabase Storage

默认使用 emoji（`🌿`），用户可选择切换为图片。

---

## 模块二：分类管理

### 数据模型变更

复用现有 `is_default` 字段标识"不可删除"的预设分类。预设的 12 个默认分类 `is_default = 1`，用户自建的分类 `is_default = 0`。

新增软删除支持：

```sql
ALTER TABLE categories ADD COLUMN deleted_at TEXT;
```

### 删除策略：软删除

- 删除分类时设置 `deleted_at` 时间戳，不真正从数据库移除
- 已关联该分类的历史交易不受影响，账单列表和统计报表正常显示分类名和图标
- 新记账选分类时不显示已删除的分类（查询条件 `WHERE deleted_at IS NULL`）
- `is_default = 1` 的预设分类不可删除，仅可编辑名称/图标

### 数据层

扩展现有 `useLocalCategories` hook：

- `useCategories()` — 已有，查询所有未删除分类
- `useCreateCategory()` — 新增，创建自定义分类（`is_default = 0`）
- `useUpdateCategory()` — 新增，编辑名称/图标
- `useDeleteCategory()` — 新增，软删除（仅 `is_default = 0` 的可删）

### UI 交互

1. **分类管理页面** (`/category-manage`)：
   - 顶部切换 Tab：「支出」/「收入」
   - 分类列表：图标 + 名称，右侧显示操作按钮
   - 预设分类（`is_default = 1`）：只能编辑名称/图标，不能删除
   - 自定义分类（`is_default = 0`）：可编辑、可删除（左滑删除 或 点击进入编辑页）
   - 底部「添加分类」按钮
2. **添加/编辑分类页面** (`/category-edit`)：
   - 分类名称输入
   - Emoji 图标选择器（和头像的 emoji 选择器复用同一组件）
   - 类型选择：支出/收入（新增时选择，编辑时不可更改）

---

## 模块三：预算设置

### 数据模型

无变更。现有 `budgets` 表已支持按分类设预算：

- `category_id = NULL` → 总预算（已有功能）
- `category_id = "xxx"` → 分类预算（新增功能）

### 数据层

扩展现有 `useLocalBudgets` hook：

- `useBudgets()` — 已有，获取所有预算
- `useGlobalBudget()` — 新增，筛选 `category_id = NULL` 的总预算
- `useCategoryBudgets()` — 新增，筛选 `category_id != NULL` 的分类预算
- `useCreateBudget()` — 已有，复用
- `useUpdateBudget()` — 已有，复用
- `useDeleteBudget()` — 已有，复用

### 预算关系

总预算和分类预算**相互独立**：
- 总预算管控总支出上限
- 分类预算管控单项支出上限
- 两者互不关联，不要求分类预算之和等于总预算

### UI 交互

1. **预算管理页面** (`/budget-manage`)：
   - 顶部总预算卡片：金额 + 本月已用进度条，点击编辑（复用现有 `/budget-setting`）
   - 下方「分类预算」列表：每行 分类图标 + 名称 + 预算金额 + 已用进度
   - 底部「添加分类预算」按钮
2. **添加/编辑分类预算页面** (`/budget-category-edit`)：
   - 选择分类（从未设预算的分类中选）
   - 输入金额（复用现有 budget-setting 的金额输入 UI 风格）
   - 保存

---

## 模块四：我的账户

### 数据模型

新建 `accounts` 表：

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  type TEXT NOT NULL,
  initial_balance REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
```

- `type`：`'cash'` | `'bank'` | `'e_wallet'` | `'credit'` | `'custom'`，用于分组展示和预设图标推荐
- `initial_balance`：初始余额，当前余额通过 `初始余额 + 收入总和 - 支出总和` 实时计算，不存冗余数据
- 软删除策略和分类一致

`transactions` 表新增字段：

```sql
ALTER TABLE transactions ADD COLUMN account_id TEXT REFERENCES accounts(id);
```

`account_id` 可为 NULL，已有历史交易不受影响。

### 预设账户模板

用户首次使用时提供快速添加（不自动创建）：

| 名称 | 图标 | type |
|------|------|------|
| 现金 | 💰 | cash |
| 银行卡 | 🏦 | bank |
| 微信 | 💚 | e_wallet |
| 支付宝 | 💙 | e_wallet |
| 信用卡 | 💳 | credit |

### 数据层

`useLocalAccounts` hook：

- `useAccounts()` — 查询所有账户（排除软删除）
- `useAccountBalance(id)` — 计算单个账户余额（初始 + 收入 - 支出）
- `useTotalAssets()` — 计算总资产（所有账户余额之和）
- `useCreateAccount()` — 创建账户
- `useUpdateAccount()` — 编辑名称/图标/初始余额
- `useDeleteAccount()` — 软删除

### UI 交互

1. **我的账户页面** (`/accounts`)：
   - 顶部总资产卡片：显示 ¥ 总金额（渐变绿背景）
   - 账户列表：每行 图标 + 名称 + 当前余额
   - 底部「添加账户」按钮（首次使用时显示预设模板快捷选择）
2. **添加/编辑账户页面** (`/account-edit`)：
   - 图标选择（emoji 选择器，复用同一组件）
   - 账户名称输入
   - 账户类型选择（预设类型或自定义）
   - 初始余额输入
3. **记账页改动**：
   - 记账表单新增「账户」选择项（可选，不选则 `account_id = NULL`）

---

## 共享组件

### Emoji 选择器

用户信息头像、分类管理、账户管理三处都需要 emoji 选择器，提取为共享组件：

- 分组展示（表情、动物、食物、物品等）
- 搜索过滤
- 点击选择后回调

### 页面路由汇总

| 路由 | 用途 | 状态 |
|------|------|------|
| `/profile-edit` | 编辑头像和昵称 | 新增 |
| `/category-manage` | 分类列表管理 | 新增 |
| `/category-edit` | 添加/编辑分类 | 新增 |
| `/budget-manage` | 预算列表管理 | 新增 |
| `/budget-setting` | 设置预算金额 | 已有，复用 |
| `/budget-category-edit` | 添加/编辑分类预算 | 新增 |
| `/accounts` | 账户列表 | 新增 |
| `/account-edit` | 添加/编辑账户 | 新增 |

---

## 实现优先级

1. **用户信息编辑** — 最简单，改善感知最强
2. **分类管理** — 复用现有基础，主要是 UI 工作
3. **预算设置** — 已有单预算功能，扩展为列表管理
4. **我的账户** — 全新模块，工作量最大

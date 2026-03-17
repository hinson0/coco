# ChatToolBar 精简与手动记账弹窗

## 目标

精简 AI 聊天页工具栏，移除未实现的功能入口，将「快速记账」改为「手动记账」并接入已有的 `ManualEntryForm` 底部弹窗。

## 背景

当前 `ChatToolBar` 有 5 个工具按钮，其中「拍小票」和「记账模板」功能尚未实现且短期不会开发。「快速记账」改名为「手动记账」，走传统表单记账流程而非 AI 对话。

## 变更范围

### 1. ChatToolBar 工具项

从 5 项精简为 3 项：

| 图标 | 名称 | 行为 |
|------|------|------|
| ✏️ | 手动记账 | 触发 `onSelectTool('手动记账')` |
| 📊 | 月度报告 | 触发 `onSelectTool('月度报告')` — 发消息给 AI |
| 🔄 | 重复记 | 触发 `onSelectTool('重复记')` — 发消息给 AI |

删除：
- 📸 拍小票
- 📋 记账模板

**文件：** `apps/mobile/components/chat/ChatToolBar.tsx`

### 2. AI 聊天页接入 ManualEntryForm

在 `app/index.tsx` 中：
- 引入 `ManualEntryForm` 组件和 `useState` 控制弹窗可见性
- `handleSelectTool` 中对「手动记账」做特殊处理：打开弹窗而非发送消息给 AI
- 其他工具按钮行为不变（发消息给 AI）

**文件：** `apps/mobile/app/index.tsx`

### 3. ManualEntryForm 复用

复用已有的 `apps/mobile/components/ManualEntryForm.tsx`，该组件：
- 使用 React Native `Modal` + 底部滑出动画
- 表单字段：金额、分类选择、收支类型切换、日期、备注
- 提交调用 `POST /api/record/manual`
- 无需修改，直接引入使用

## 数据流

```
用户点击「手动记账」
  → ChatToolBar.onSelectTool('手动记账')
  → ChatScreen.handleSelectTool 判断 tool === '手动记账'
  → setManualEntryVisible(true)
  → ManualEntryForm 弹窗显示
  → 用户填写并提交
  → POST /api/record/manual
  → 弹窗关闭
```

## 不在范围内

- 不修改 ManualEntryForm 的功能或样式
- 不修改其他工具按钮的行为
- 不新增页面或路由

# ChatInputBar 输入状态布局优化

## 概述

优化 AI 聊天页底部输入框的交互：输入文字时隐藏周围图标按钮，输入框自动扩展，仅保留发送按钮。参考豆包 App 的输入框行为。

## 状态定义

| 状态 | 条件 | 布局 |
|------|------|------|
| 空输入 | `text.trim() === ''` | `[📷] [输入框 placeholder] [🎤] [➕]` |
| 有文字 | `text.trim() !== ''` | `[输入框 文字内容] [🔵⬆️ 发送]` |

## 变更内容

### 1. 条件渲染图标按钮

- `text.trim()` 有值时：隐藏 📷 相机、🎤 语音、➕ 加号按钮
- 输入框 `flex: 1` 保持不变，周围元素消失后自然扩展

### 2. 发送按钮样式

- 蓝色**圆形**背景（`#007AFF`，iOS 标准蓝），固定尺寸 `width: 38, height: 38`
- 白色向上箭头：使用 Unicode `↑`（项目不依赖图标库，与现有 emoji 风格一致）
- 替换当前 sage 绿色胶囊 + "发送"文字

### 3. 不引入动画

- 状态切换为直接切换，无过渡动画
- 不依赖 react-native-reanimated

## 不变的部分

- `ChatInputBarProps` 接口不变
- `handleSubmit` 提交逻辑不变
- placeholder 文本不变
- 空状态下的布局与当前一致
- 输入框 `height: 44`（初始高度）和 `maxHeight: 100`（多行上限）保持不变
- `returnKeyType: "default"` + `multiline` 保持不变（Enter 换行，专用按钮发送）

## 涉及文件

- `apps/mobile/components/chat/ChatInputBar.tsx` — 唯一修改文件

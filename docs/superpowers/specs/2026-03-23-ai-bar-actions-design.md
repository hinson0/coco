# AI 页底部栏目功能实现设计

> 日期：2026-03-23
> 状态：待实现

## 背景

`ChatInputBar` 底部栏的三个按钮（📷 相机、🎤 麦克风、➕ 更多）当前 handler 为空函数。
后端逻辑（`useChat` 的 `sendOcr`、`sendAsr`、`sendText`）已就绪，需补全前端交互和原生 API 调用。

## 方案：拆分子组件 + Hook

将原生能力封装为独立 hook，`ChatInputBar` 管理模式切换，具体能力委托给 hook/子组件。

## 1. 📷 相机 — `useCamera` hook

**文件**：`hooks/useCamera.ts`（~30 行）

**接口**：
```typescript
function useCamera(): {
  pickImage: () => Promise<string | null>; // base64 或 null（取消/拒绝）
}
```

**流程**：
1. `requestCameraPermissionsAsync()` 请求权限
2. 权限拒绝 → `Alert.alert` 提示用户去设置开启
3. `launchCameraAsync({ quality: 0.6, base64: true })` 启动相机
4. 拍照成功 → 返回 base64；取消 → 返回 null

**依赖**：`expo-image-picker`（已在 package.json）

## 2. 🎤 语音模式 — `useVoiceRecorder` hook

**文件**：`hooks/useVoiceRecorder.ts`（~60 行）

**接口**：
```typescript
function useVoiceRecorder(): {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>; // base64 或 null
  cancelRecording: () => Promise<void>;        // 取消，不返回数据
}
```

**流程**：
1. `startRecording`：请求麦克风权限 → 创建 `Recording` 实例 → 开始录音
2. `stopRecording`：停止录音 → 获取文件 URI → 读取为 base64 → 返回
3. `cancelRecording`：停止录音 → 丢弃文件 → 不返回数据

**依赖**：`expo-audio`（已在 package.json），`expo-file-system`（读取文件为 base64）

## 3. ➕ 快捷操作 — `QuickActions` 组件

**文件**：`components/chat/QuickActions.tsx`（~50 行）

**接口**：
```typescript
interface QuickActionsProps {
  readonly visible: boolean;
  readonly onSelect: (text: string) => void;
}
```

**预设项**（可配置数组）：
```typescript
const QUICK_ACTIONS = [
  { icon: '📅', label: '本周报告', text: '本周报告' },
  { icon: '📈', label: '月度趋势', text: '本月趋势' },
  { icon: '💰', label: '今日花费', text: '今天花了多少' },
  { icon: '🏷️', label: '分类统计', text: '各分类支出统计' },
];
```

**交互**：
- 点击 + → 展开面板（在输入栏上方）
- 再次点击 + → 收起
- 点击快捷项 → 发送预设文本 + 收起面板

**样式**：复用 `ChatToolBar` 的胶囊标签风格，水平滚动布局。

## 4. `ChatInputBar` 改造

**新增状态**：
- `mode: 'text' | 'voice'` — 输入模式
- `plusExpanded: boolean` — QuickActions 展开状态

**回调接口变更**：
```typescript
interface ChatInputBarProps {
  readonly onSendText: (text: string) => void;
  readonly onCamera: () => void;
  readonly onVoice: (audioBase64: string) => void;  // 改为接收 base64
  readonly onQuickAction: (text: string) => void;    // 替代 onPlus
}
```

**文字模式布局**：
```
📷 | [输入框 placeholder="记一笔..."] | 🎤 | +
```
输入文字后右侧变为发送按钮（现有逻辑不变）。

**语音模式布局**：
```
📷 | [按住说话] | ⌨️ | +
```

**录音交互**：
- 长按「按住说话」→ `startRecording()`，按钮文字变为「松开发送」
- 松手 → `stopRecording()` → 拿到 base64 → 调用 `onVoice(base64)`
- 手指滑出按钮区域 → 文字变「松开取消」，松手调用 `cancelRecording()`
- 手指滑回 → 恢复「松开发送」

**滑动取消实现**：
- `onPressIn` + `onLayout` 获取按钮边界
- `onTouchMove` 实时判断触摸点是否在按钮区域内
- 状态分三态：`idle` / `recording` / `cancelling`

## 5. `index.tsx` 接入

```typescript
const { pickImage } = useCamera();
const { sendText, sendOcr, sendAsr } = useChat();

<ChatInputBar
  onSendText={sendText}
  onCamera={async () => {
    const base64 = await pickImage();
    if (base64) sendOcr(base64);
  }}
  onVoice={(base64) => sendAsr(base64)}
  onQuickAction={(text) => sendText(text)}
/>
```

## 新增文件清单

| 文件 | 类型 | 预估行数 |
|------|------|----------|
| `hooks/useCamera.ts` | Hook | ~30 |
| `hooks/useVoiceRecorder.ts` | Hook | ~60 |
| `components/chat/QuickActions.tsx` | 组件 | ~50 |

## 修改文件清单

| 文件 | 变更内容 |
|------|----------|
| `components/chat/ChatInputBar.tsx` | 增加 mode 切换、语音模式 UI、长按手势、滑动取消 |
| `app/index.tsx` | 接入 useCamera，修改回调签名 |

## 依赖

所有依赖已在 `package.json` 中声明，无需新增：
- `expo-image-picker@~55.0.12`
- `expo-audio@~55.0.8`
- `expo-file-system`（读取音频文件为 base64）

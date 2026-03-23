# 小票识别缩略图 + 点击放大设计

> 日期：2026-03-23
> 状态：待实现

## 背景

`sendOcr` 当前存储 `content: "[拍照]"` 占位文本，导致 `OcrBubble` 无法显示实际拍照图片。需要：
1. 存储实际图片到本地文件系统
2. 在气泡中显示缩略图
3. 点击缩略图弹出全屏预览，点击关闭

## 方案：抽取通用 ImagePreview + 改造存储

### 1. 图片存储改造 — `useChat.ts`

`sendOcr` 流程改为：
1. 收到 base64 → 确保目录存在 → 写入文件（使用 `${Date.now()}-${randomUUID()}` 避免文件名碰撞）
2. message content 存本地文件路径（`file://...`）
3. base64 仍发送给后端 API（不变）

文件写入失败时 fallback 到 `"[拍照]"` 占位符，不阻断 OCR 流程。

```typescript
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';

// 在 sendOcr 中：
let imageContent = '[拍照]';
try {
  const dir = `${FileSystem.documentDirectory}ocr-images/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const filePath = `${dir}${Date.now()}-${Crypto.randomUUID()}.jpg`;
  await FileSystem.writeAsStringAsync(filePath, imageBase64, { encoding: FileSystem.EncodingType.Base64 });
  imageContent = filePath;
} catch {
  // 磁盘空间不足等异常，fallback 到占位符
}
await addMessage({ role: "user", content_type: "image", content: imageContent });
```

**依赖**：`expo-file-system`、`expo-crypto`（均已在 package.json）

### 2. 通用组件 — `ImagePreview`

**文件**：`components/ui/ImagePreview.tsx`（~60 行）

**接口**：
```typescript
interface ImagePreviewProps {
  readonly uri: string;       // 本地文件路径或远程 URL
  readonly style?: StyleProp<ViewStyle>;  // 外部控制尺寸
}
```

**行为**：
- 缩略图填充父容器（`width: '100%'`, `height: '100%'`, `resizeMode="cover"`），尺寸由父容器控制
- 点击 → 弹出 `Modal`（`transparent`, `animationType="fade"`）
- Modal 内容：黑色半透明背景 `rgba(0,0,0,0.85)` + 图片居中（`resizeMode="contain"`, 宽高自适应屏幕）
- 点击 Modal 任意位置 → 关闭
- `onRequestClose` 处理 Android 硬件返回键关闭 Modal

### 3. `OcrBubble` 改造

**向后兼容判断**（在 `OcrBubble` 内部处理）：
```typescript
const hasValidImage = imageUri != null
  && (imageUri.startsWith('file://') || imageUri.startsWith('http'));
```

- `hasValidImage === true`：在 `imageArea` 内渲染 `ImagePreview`（`ImagePreview` 自动填充 160×120 的 `imageArea` 容器）
- `hasValidImage === false`：保持现有 🧾 placeholder 不变（兼容历史 `"[拍照]"` 消息）
- 底部 `📸 小票识别` 绿条不变

## 文件清单

| 操作 | 文件 | 变更 |
|------|------|------|
| 新建 | `components/ui/ImagePreview.tsx` | 通用图片预览组件 |
| 修改 | `components/chat/OcrBubble.tsx` | 引入 ImagePreview，添加 URI 校验 |
| 修改 | `hooks/useChat.ts` | sendOcr 存图片到文件系统，带 fallback |

## 依赖

无需新增，`expo-file-system` 和 `expo-crypto` 已在 package.json。

## 已知 TODO（后续优化）

- **图片存储清理**：当用户删除聊天消息时，关联的 `ocr-images/` 文件应同步删除。当前不实现，标记为后续优化。
- **全屏预览加载状态**：大图加载中可添加 `ActivityIndicator`，当前不实现。

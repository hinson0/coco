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
1. 收到 base64 → 确保目录存在 → 写入 `${documentDirectory}ocr-images/${Date.now()}.jpg`
2. message content 存本地文件路径（`file://...`）
3. base64 仍发送给后端 API（不变）

```typescript
// 之前
await addMessage({ role: "user", content_type: "image", content: "[拍照]" });

// 之后
const dir = `${FileSystem.documentDirectory}ocr-images/`;
await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
const filePath = `${dir}${Date.now()}.jpg`;
await FileSystem.writeAsStringAsync(filePath, imageBase64, { encoding: FileSystem.EncodingType.Base64 });
await addMessage({ role: "user", content_type: "image", content: filePath });
```

**依赖**：`expo-file-system`（已在 package.json）

### 2. 通用组件 — `ImagePreview`

**文件**：`components/ui/ImagePreview.tsx`（~60 行）

**接口**：
```typescript
interface ImagePreviewProps {
  readonly uri: string;       // 本地文件路径或远程 URL
  readonly width: number;     // 缩略图宽度
  readonly height: number;    // 缩略图高度
  readonly borderRadius?: number;
}
```

**行为**：
- 默认渲染缩略图（`Image` + 指定宽高 + `resizeMode="cover"`）
- 点击 → 弹出 `Modal`（`transparent`, `animationType="fade"`）
- Modal 内容：黑色半透明背景 `rgba(0,0,0,0.85)` + 图片居中（`resizeMode="contain"`, 宽高自适应屏幕）
- 点击 Modal 任意位置 → `setVisible(false)` 关闭

### 3. `OcrBubble` 改造

**改动点**：
- `imageUri` 有效时（以 `file://` 或 `http` 开头）：用 `ImagePreview` 替换当前的 `Image`，宽度 160，高度 120
- `imageUri` 无效或缺失：保持现有 🧾 placeholder 不变
- 底部 `📸 小票识别` 绿条不变

## 文件清单

| 操作 | 文件 | 变更 |
|------|------|------|
| 新建 | `components/ui/ImagePreview.tsx` | 通用图片预览组件 |
| 修改 | `components/chat/OcrBubble.tsx` | 引入 ImagePreview 替换 Image |
| 修改 | `hooks/useChat.ts` | sendOcr 存图片到文件系统 |

## 依赖

无需新增，`expo-file-system` 已在 package.json。

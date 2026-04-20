# OCR 按钮：新增「拍照 / 相册」来源选择

## Context

当前 ChatInputBar 的 📷 按钮点击后直接调用 `useCamera.pickImage()` → `launchCameraAsync`，用户只能现场拍照。但真实场景里小票可能已经在相册（朋友发来的截图、从微信保存的图、之前忘了处理的收据），没有「从相册选」的入口就要用户再拍一遍或手动输入，体验受阻。

目标：点击 📷 后先弹出一个来源选择面板（拍照 / 相册），选中后再走各自的获取流程，最终复用现有 `sendOcr()` 管道。UI 按用户截图：附着在输入框上方的悬浮卡片，横向 2 列（只要「拍照 / 相册」，不要「文件」）。

---

## UI/UX 设计（文字稿，供后续 /playground 落地 HTML 原型）

### 布局

- 触发：点击 ChatInputBar 左侧的 📷 按钮
- 位置：输入框 **上方** 的悬浮卡片（不是全屏底部 Modal），与 `QuickActions` 同级别渲染
- 展开动画：`Animated` 淡入 + 轻微向上位移（150ms），收起反向
- 关闭方式：
  - 点击卡片外区域
  - 按系统返回键（Android）
  - 选中任一选项后自动关闭
  - 再次点击 📷 切换（与 `plusExpanded` 一致的 toggle 行为）

### 卡片样式

- 背景：`colors.white`，`borderRadius: radii.xl`，`shadows.md`
- 内边距：`spacing.lg`，水平居中
- 宽度：`90%` 容器宽或自适应，最大宽 `320`
- 内部 2 列 Grid（`flexDirection: "row"`, `gap: spacing.md`）
- 每个选项为独立卡片按钮：
  - 尺寸：`flex: 1`，`aspectRatio: 1.1`
  - 背景：`colors.cream`，`borderRadius: radii.lg`
  - 顶部 emoji/icon（size 2xl），下方 label（size md, weight medium）
  - 点击态：`opacity: 0.75` + `Haptics.selectionAsync()`

### 文案

- 选项 1：`📷 拍照`
- 选项 2：`🖼️ 相册`（注意 `emoji + 文字`，保持与截图呼应）
- 没有"取消"按钮（面板外点击即关）

### 冲突处理

- 展开「来源选择面板」时，如果 `plusExpanded` 为 true，则先收起 QuickActions（互斥）
- 点击 🎤/⌨️ 切语音模式、点击 ➕ 展开快捷动作时，同样自动收起本面板

---

## 实施步骤

### 1. 扩展 `useCamera` 支持相册选择

**文件：** `apps/mobile/hooks/useCamera.ts`

新增 `pickFromLibrary()`：复用同一个 hook，返回签名保持 `Promise<string | null>`，与 `pickImage` 一致（返回 base64 或 null）。

```ts
const pickFromLibrary = useCallback(async (): Promise<string | null> => {
  const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!granted) {
    Alert.alert("需要相册权限", "请在系统设置中允许 Coco 访问相册", [
      { text: "取消", style: "cancel" },
      { text: "去设置", onPress: () => Linking.openSettings() },
    ]);
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    base64: true,
    quality: 0.6,
  });
  if (result.canceled) return null;
  return result.assets[0].base64 ?? null;
}, []);

return { pickImage, pickFromLibrary };
```

**复用点：** 权限拒绝分支的 UI 文案、`Alert` 跳转设置的结构，与 `pickImage` 对齐，无需新抽象。

### 2. 新增 `ImageSourceSheet` 组件（悬浮卡片）

**新文件：** `apps/mobile/components/chat/ImageSourceSheet.tsx`

参考 `components/chat/QuickActions.tsx` 的 visible 受控 + 动画模式（它本身是一个条件渲染的横向条，和本需求结构相同），不引入 Modal。Props：

```ts
interface ImageSourceSheetProps {
  readonly visible: boolean;
  readonly onPickCamera: () => void;
  readonly onPickLibrary: () => void;
}
```

- 内部 2 个 `Pressable`，各自触发对应回调
- 选中后**不**在组件里关闭，交给父组件 `onPickXxx` 回调里先 `setVisible(false)` 再 `await hook`，避免权限弹窗与收起动画竞态
- 复用 `colors / spacing / radii / shadows / typography` 主题常量，不要硬编码色值

### 3. 修改 `ChatInputBar` 集成面板

**文件：** `apps/mobile/components/chat/ChatInputBar.tsx`

- 新增 state：`const [sourceSheetOpen, setSourceSheetOpen] = useState(false);`
- `onCamera` prop 语义变更：从「直接触发相机」→「触发来源选择」。考虑到 props 已经叫 `onCamera` 且含义变了，建议**保留旧 prop**并新增 `onPickLibrary`，即把「获取 base64」的动作放在父组件（index.tsx）中；InputBar 只负责切换 `sourceSheetOpen`：

```tsx
interface ChatInputBarProps {
  onPickCamera: () => void;    // 新增/替换 onCamera
  onPickLibrary: () => void;   // 新增
  // 其他保持不变
}
```

- 📷 按钮点击改为 `setSourceSheetOpen(v => !v)`，并同时 `setPlusExpanded(false)`、退出 `voiceMode`（与现有互斥逻辑一致）
- 在 `<QuickActions>` 后、`<View style={styles.container}>` 前/后插入 `<ImageSourceSheet />`，位置与 QuickActions 同级
- 点击任一选项：先 `setSourceSheetOpen(false)`，再调用对应回调

### 4. 父组件分发来源回调

**文件：** `apps/mobile/app/index.tsx`

- `useCamera()` 解构新增 `pickFromLibrary`
- 替换：

```tsx
onPickCamera={async () => {
  const base64 = await pickImage();
  if (base64) sendOcr(base64, onOcrFail);
}}
onPickLibrary={async () => {
  const base64 = await pickFromLibrary();
  if (base64) sendOcr(base64, onOcrFail);
}}
```

### 5. 补相册权限文案到 `app.json`

**文件：** `apps/mobile/app.json`

在 `expo-image-picker` 插件配置里加 `photosPermission`（iOS 首次访问相册必需 `NSPhotoLibraryUsageDescription`，否则 iOS 14+ 直接崩溃）：

```json
[
  "expo-image-picker",
  {
    "cameraPermission": "允许 Coco 使用相机拍摄小票进行记账",
    "photosPermission": "允许 Coco 访问相册以选择小票图片进行记账"
  }
]
```

---

## 关键文件清单

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `apps/mobile/hooks/useCamera.ts` | 修改 | 新增 `pickFromLibrary` |
| `apps/mobile/components/chat/ImageSourceSheet.tsx` | 新建 | 悬浮来源选择卡片 |
| `apps/mobile/components/chat/ChatInputBar.tsx` | 修改 | 接入面板，改 props 语义 |
| `apps/mobile/app/index.tsx` | 修改 | 分发两个来源回调 |
| `apps/mobile/app.json` | 修改 | 补 `photosPermission` 文案 |

**复用项（不新建）：**
- 颜色/间距：`apps/mobile/constants/theme.ts`
- 文本组件：`apps/mobile/components/ui/AppText.tsx`
- 权限拒绝 UX 模板：照抄 `useCamera.pickImage` 分支
- OCR 管道：`useChat.sendOcr`，无需改动
- 触觉反馈：`expo-haptics`（项目已用）

---

## 回归风险点

1. **ChatInputBar props 变更**：`onCamera` → `onPickCamera / onPickLibrary`。只有 `app/index.tsx` 一个调用点，改完后 TypeScript 会直接报错定位，不会漏
2. **权限二连弹**：iOS 上第一次点击「相册」会弹系统权限框，用户拒绝后再次点击走「引导去设置」分支——与相机逻辑一致，用户心智统一
3. **面板 z-index**：悬浮卡片必须在输入栏之上、键盘之下；放在 `<View>` 根组件里 `QuickActions` 旁边即可，不需要 Portal
4. **Android 返回键**：不接管返回键，面板开启时按返回键走原逻辑（退出 Chat 页）——第一期可接受，后续如需接管再加 `BackHandler`

---

## 验证步骤

在 **批准 plan 并退出 Plan 模式** 后按顺序执行：

### Step 0（用户明确要求）：先出 playground 原型
1. 调用 `/playground` skill，输入本 plan 的 UI/UX 章节
2. 在浏览器里确认面板尺寸、间距、emoji 位置、点击态符合预期
3. 如有调整，回填到此 plan 的「UI/UX 设计」章节再进入编码

### Step 1：代码改造（按「实施步骤」顺序执行 1→5）

### Step 2：本地联调
- `cd apps/mobile && pnpm dev`（或项目已有的启动脚本）
- iOS 模拟器与真机各测一次：
  - [ ] 点 📷 弹出面板，外部点击收起
  - [ ] 选「拍照」→ 权限流 → 拍照 → OCR 结果正常展示
  - [ ] 选「相册」→ 权限流 → 选图 → OCR 结果正常展示
  - [ ] 权限拒绝时「去设置」按钮可用
  - [ ] 面板打开时点 ➕ 或切语音模式，面板自动收起
  - [ ] 键盘展开中点 📷，面板位置不被遮挡
- Android 模拟器快速走一遍相同 checklist

### Step 3：CI 与提交
- `just cicd-fe`（项目规约：push 前必须跑完整前端 CI，不能只 lint）
- `/simplify` 检查重复代码
- 按 PR 规约走：commit message 中文，不直接 push main，走 PR 流程

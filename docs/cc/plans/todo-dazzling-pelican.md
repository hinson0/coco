# 降低「自动」页面用户心智负担

## Context

「自动」tab 当前要求用户完成 3 步设置：通知监听、通知权限、后台运行。这对首次进入应用的用户而言**信息密度过高、心智重**：

- 「通知权限」的请求实际上在 App 第一次启动时（`apps/mobile/app/_layout.tsx` 中的 `requestPermissionsAsync`）就已触发过了，再放在「自动」页面属于重复展示
- 「后台运行」属于 Android 系统级进阶配置（自启动 + 电量策略），并非每个用户必须深入；**只有真正想让自动记账更稳定的高级用户才需要它**
- 三步并列展示让真正核心的「通知监听」（自动记账的入口能力）失去了焦点

**目标**：

1. 「自动」页面保持只有「通知监听」一个核心开关 + 原有的科普教学内容（支持的应用 / 工作原理 / 效果演示）
2. 在「我的」tab 的「工具」分组中新增「更聪明的 CoCo」入口 → 二级页面 `/smarter-coco`，将「通知权限」+「后台运行」搬到这里，定位为"进阶优化"
3. 当通知监听已开但通知权限 / 后台运行未配置时，在「自动」页面顶部显示一个轻量提示条引导用户去「更聪明的 CoCo」

## 改动文件清单

### 新建

| 路径 | 作用 |
|------|------|
| `apps/mobile/app/smarter-coco.tsx` | 新二级页面，承载「通知权限」「后台运行」两个 SetupStep + 完整图文引导 |
| `apps/mobile/components/auto/SetupStep.tsx` | 从 `auto-guide.tsx` 抽出的共享组件（原 lines 62-121） |
| `apps/mobile/components/auto/GuideImage.tsx` | 从 `auto-guide.tsx` 抽出的共享组件（原 lines 39-58） |

### 修改

| 路径 | 改动 |
|------|------|
| `apps/mobile/app/(tabs)/auto-guide.tsx` | 删除 Step 2/3；新增提示条；改用共享组件；图片资源拆分 |
| `apps/mobile/app/(tabs)/profile.tsx` | 「工具」Card 中新增 MenuItem「更聪明的 CoCo」 |

## 详细设计

### 1. 抽离共享组件

`SetupStep` 与 `GuideImage` 目前是 `auto-guide.tsx` 的私有组件，新页面要复用，必须抽离：

- **`apps/mobile/components/auto/SetupStep.tsx`** — 直接搬运 `auto-guide.tsx` 中的 lines 62-121 + 相关 styles（`stepCard / stepHeader / stepLeft / stepNumber / stepNumberDone / runningTag / stepBody / stepBtn`）
- **`apps/mobile/components/auto/GuideImage.tsx`** — 搬运 lines 39-58 + 相关 styles（`guideImageWrap / guideImageBtn / guideImage`）
- 类型与 props 不变，保持 readonly 修饰

### 2. 新页面 `apps/mobile/app/smarter-coco.tsx`

结构：

```
[Header 标题: "更聪明的 CoCo" + 副标题: "开启进阶能力，让自动记账更稳定"]

[SetupStep step={1} title="通知权限"]
  - done = notifEnabled && channelEnabled
  - onPress = AutoBookkeeping.openNotificationSettings()
  - 4 张 GuideImage（搬自 auto-guide.tsx Step 2）

[SetupStep step={2} title="后台运行"]
  - done = listenerGranted && notifEnabled && channelEnabled (沿用原 allDone 逻辑,
    因为 Android 自启动状态无法编程查询,只能用其他权限完成度作为代理信号)
  - onPress = AutoBookkeeping.openAutoStartSettings()
  - 2 张 GuideImage（搬自 auto-guide.tsx Step 3）
```

实现注意点：

- 复用 `auto-guide.tsx` 的 `AutoBookkeeping` 平台动态加载模式（lines 28-35），iOS 显示"仅 Android 支持"的占位
- 复用 `useEffect + setInterval(checkAll, 3000)` 的轮询模式（lines 138-142），让用户从系统设置返回时状态自动刷新
- 使用 `Stack.Screen` header（与 `profile-edit / accounts / budget-manage` 等现有二级页面保持一致），无 tab bar
- 图片资源 require：`guideNotifMain / guideNotifChannel1-3 / guideAutoStart / guideBattery` 这 6 张搬到新页面

### 3. 改造「自动」页面 `apps/mobile/app/(tabs)/auto-guide.tsx`

**删除**：
- Step 2「通知权限」整段（lines 211-246）
- Step 3「后台运行」整段（lines 248-269）
- 不再使用的图片 require：`guideNotifMain / guideNotifChannel1-3 / guideAutoStart / guideBattery`
- 不再使用的状态：`notifEnabled / channelEnabled / setNotifEnabled / setChannelEnabled` 及其 polling 调用
- 不再使用的派生：`allDone`（顶部"全部就绪"标签也随之去掉，因为只有 1 步）

**新增**：在 `SetupStep step={1}` 与「支持的应用」section 之间插入提示条：

```tsx
{listenerGranted && !smarterFullyConfigured ? (
  <TouchableOpacity
    style={styles.tipBar}
    onPress={() => router.push("/smarter-coco")}
    activeOpacity={0.7}
  >
    <AppText size="md" color={colors.text}>
      ✨ 解锁进阶能力，让自动记账更稳定
    </AppText>
    <AppText size="md" color={colors.sage}>去优化 ›</AppText>
  </TouchableOpacity>
) : null}
```

- `smarterFullyConfigured` 通过保留对 `areNotificationsEnabled() / isChannelEnabled()` 的 polling 计算（自启动无法查询，只能用通知相关 2 个状态作为可见的"未完成"信号）
- 视觉风格：浅色卡片 + sage 强调色，区别于 SetupStep 的绿色按钮

**保留**：
- 通知监听 SetupStep（含 `guideNotifListener1 / guideNotifListener2`）
- 「支持的应用」「工作原理」「效果演示图」整段
- `__DEV__` 调试按钮

**改名建议**：文件名 `auto-guide.tsx` 保持不变（路由 URL 已经稳定，避免破坏现有跳转）

### 4. 「我的」页面 `apps/mobile/app/(tabs)/profile.tsx`

在「工具」Card（lines 233-254）的「多设备同步」之后新增一项：

```tsx
<View style={styles.separator} />
<MenuItem
  icon="✨"
  iconBg={colors.sagePale}
  title="更聪明的 CoCo"
  onPress={() => router.push("/smarter-coco")}
/>
```

- 图标 `✨` 与提示条呼应
- `iconBg` 用 `colors.sagePale`（与「导出报表」「多设备同步」一致）

## 复用的现有资源

- **`SetupStep / GuideImage`** — 抽离后两个页面复用
- **`MenuItem`**（`apps/mobile/components/shared/MenuItem.tsx`） — 「我的」页面新条目使用现有组件
- **`AutoBookkeeping` 原生模块** — 三个 `open*Settings()` 方法 + 三个状态查询方法直接复用
- **`Card / AppText / PulseDot`** — UI 原子组件
- **`router.push`**（`expo-router`） — 跳转方式与现有二级页面（profile-edit / accounts 等）一致
- **轮询模式** — 复用 `useEffect + setInterval(3000)` 让用户从系统设置返回时自动刷新

## 验证方式（端到端）

> 必须在真机/模拟器（Android）上完成，因为涉及系统设置跳转

1. **启动开发服务器**
   ```bash
   cd apps/mobile && pnpm start
   ```

2. **「自动」页面**
   - 进入「自动」tab，确认页面只剩 1 个 SetupStep（通知监听）+ 支持的应用 + 工作原理 + 效果演示
   - 确认顶部不再有"全部就绪"状态标签
   - 当通知监听**已授权**但通知权限未开 → 顶部出现提示条「✨ 解锁进阶能力 …」
   - 通知监听**未授权**时不显示提示条（避免一次塞太多决策）

3. **「我的」→ 工具**
   - 进入「我的」tab，「工具」分组中能看到 4 项：导出报表 / 记账提醒 / 多设备同步 / 更聪明的 CoCo
   - 点击「更聪明的 CoCo」跳转到 `/smarter-coco`

4. **`/smarter-coco` 页面**
   - 标题、副标题正确
   - 2 个 SetupStep 状态可正确切换（去系统设置开关后，返回应用 3 秒内更新为"运行中"）
   - 4 张 + 2 张图文引导可展开/折叠
   - iOS 显示"仅 Android 支持"占位

5. **提示条往返**
   - 在 `/smarter-coco` 中开完所有权限后，回到「自动」页面 → 提示条消失

6. **静态检查**
   ```bash
   pnpm -F mobile typecheck
   pnpm -F mobile lint
   ```

## 范围边界（不做）

- 不改 onboarding 阶段的通知权限请求逻辑（`apps/mobile/app/_layout.tsx`）
- 不抽更通用的 ListMenu / SectionCard 组件，仅抽 SetupStep / GuideImage 这两个被复用的
- 不改原生模块 `expo-auto-bookkeeping` 的 API
- 不调整 tab bar 顺序与图标

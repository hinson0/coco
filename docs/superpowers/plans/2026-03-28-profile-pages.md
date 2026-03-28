# Profile 页面功能完善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修改 AI 助手图标为绿叶子，新增升级 Pro / 意见反馈 / 关于棉花记三个页面，并在 Profile 主页接入路由跳转。

**Architecture:** 4 个独立改动，互不依赖。3 个新页面均为纯 UI 展示（无后端调用），遵循项目现有页面模式：`useSafeAreaInsets()` + 标准 Header + cream 背景 + Card 容器。最后在 profile.tsx 中为三个 MenuItem 添加 onPress 路由。

**Tech Stack:** React Native, Expo Router, expo-linear-gradient, react-native-safe-area-context

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `apps/mobile/components/profile/AiAssistantCard.tsx` | 图标 🤖 → 🍃 |
| Create | `apps/mobile/app/upgrade-pro.tsx` | 升级 Pro 页面 |
| Create | `apps/mobile/app/feedback.tsx` | 意见反馈页面 |
| Create | `apps/mobile/app/about.tsx` | 关于棉花记页面 |
| Modify | `apps/mobile/app/(tabs)/profile.tsx` | 三个菜单项添加 onPress 路由 |

---

### Task 1: AI 助手图标改为绿叶子

**Files:**
- Modify: `apps/mobile/components/profile/AiAssistantCard.tsx:18`

- [ ] **Step 1: 修改 emoji**

在 `AiAssistantCard.tsx` 第 18 行，将 `🤖` 替换为 `🍃`：

```typescript
// Before
<AppText size="2xl">🤖</AppText>

// After
<AppText size="2xl">🍃</AppText>
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/profile/AiAssistantCard.tsx
git commit -m "style: change AI assistant card icon to leaf emoji"
```

---

### Task 2: 升级 Pro 页面

**Files:**
- Create: `apps/mobile/app/upgrade-pro.tsx`

- [ ] **Step 1: 创建升级 Pro 页面**

创建 `apps/mobile/app/upgrade-pro.tsx`，包含以下结构：
- Header：← 返回 | "升级 Pro" 标题 | 占位
- Sage 渐变 banner：🍃 棉花记 Pro + "解锁全部记账能力"
- 免费功能区：✅ 图标 + "手动记账 / 文字记账" 说明
- 广告解锁区：Card 内 3 行（1 条/2 条/3 条广告对应权益）
- Pro 会员区：月/年两张卡片并排，年卡带"推荐"标签，选中态 sage 边框
- 底部 "立即开通" 按钮（sage 色），点击弹 Alert "功能开发中"
- 底部提示文字："🎁 新用户注册享 21 天全功能免费体验"

关键实现细节：
- `useState<'monthly' | 'yearly'>('yearly')` 控制选中态
- banner 渐变色 `['#5a9468', '#7ba68a']`
- 选中卡片边框：`borderColor: colors.sage, borderWidth: 2`
- 未选中卡片：`borderColor: colors.creamDark, borderWidth: 1`
- 立即开通按钮：`Alert.alert('提示', '功能开发中，敬请期待')`
- 页面模式：`useSafeAreaInsets()` + cream 背景 + ScrollView

导入参考（从其他页面如 `budget-manage.tsx` 和 `accounts.tsx` 提取）：
```typescript
import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../components/ui/AppText';
import { Card } from '../components/ui/Card';
import { colors, radii, shadows } from '../constants/theme';
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/upgrade-pro.tsx
git commit -m "feat: add upgrade-pro page with pricing UI"
```

---

### Task 3: 意见反馈页面

**Files:**
- Create: `apps/mobile/app/feedback.tsx`

- [ ] **Step 1: 创建意见反馈页面**

创建 `apps/mobile/app/feedback.tsx`，包含以下结构：
- Header：← 返回 | "意见反馈" 标题 | 占位
- 反馈类型标签选择：`['功能建议', 'Bug报告', '其他']`，默认选中"功能建议"
  - 选中态：sage 背景 + 白色文字
  - 未选中：creamDark 背景 + textLight 文字
- 多行文本输入框：placeholder "请描述你的问题或建议..."，maxLength 500
  - 右下角字数统计 "xx/500"
  - 最少 10 字才能提交
- 联系方式输入（选填）：单行 TextInput，placeholder "邮箱或微信号"
- 底部提交按钮：跟随键盘高度
  - 字数 < 10 时置灰（disabled）
  - 点击后拼接 mailto URL 并调用 `Linking.openURL`
  - 若打开失败弹 Alert 提示邮箱地址

关键实现细节：
```typescript
import { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Alert, Keyboard, Linking } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/ui/AppText';
import { Card } from '../components/ui/Card';
import { colors, radii } from '../constants/theme';
```

- 键盘监听：`Keyboard.addListener('keyboardDidShow/Hide')` 动态调整底部按钮位置（参考 `profile-edit.tsx:31-35`）
- mailto 拼接：
```typescript
const email = 'feedback@example.com';
const subject = encodeURIComponent(`【${feedbackType}】棉花记反馈`);
const body = encodeURIComponent(`${content}\n\n联系方式：${contact}`);
const url = `mailto:${email}?subject=${subject}&body=${body}`;
Linking.openURL(url).catch(() => {
  Alert.alert('提示', `请发送邮件至 ${email}`);
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/feedback.tsx
git commit -m "feat: add feedback page with mailto submission"
```

---

### Task 4: 关于棉花记页面

**Files:**
- Create: `apps/mobile/app/about.tsx`

- [ ] **Step 1: 创建关于棉花记页面**

创建 `apps/mobile/app/about.tsx`，包含以下结构：
- Header：← 返回 | "关于棉花记" 标题 | 占位
- 顶部 Logo 区：大号 🍃 + "棉花记" bold + 版本号（浅色）
- 功能亮点区（Card 内列表）：
  - 🤖 AI 智能记账
  - 🎤 语音记账
  - 📸 小票识别
  - 📊 预算管理与统计
  - 💰 多账户管理
  - 📤 报表导出
- 更多操作区（Card 内 MenuItem 风格）：
  - 检查更新 → `Alert.alert('提示', '已是最新版本')`
  - 用户协议 → `Linking.openURL('https://example.com/terms')`
  - 隐私政策 → `Linking.openURL('https://example.com/privacy')`
- 底部版权信息："联系我们: feedback@example.com" + "© 2025 棉花记"

关键实现细节：
```typescript
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { AppText } from '../components/ui/AppText';
import { Card } from '../components/ui/Card';
import { MenuItem } from '../components/shared/MenuItem';
import { colors, radii } from '../constants/theme';
```

- 版本号：`Constants.expoConfig?.version ?? '1.0.0'`
- 功能亮点列表用简单的 emoji + 文字行，行间用分隔线
- MenuItem 复用已有组件，但 icon/iconBg 需要传入合适的颜色

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/about.tsx
git commit -m "feat: add about page with app info and features"
```

---

### Task 5: Profile 主页路由接入

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx:127-136`

- [ ] **Step 1: 为三个 MenuItem 添加 onPress**

在 `profile.tsx` 中，为"其他"区域的三个 MenuItem 添加路由跳转：

```typescript
// 升级Pro (第 127-131 行)
<MenuItem
  icon="🌟"
  iconBg={colors.coralPale}
  title="升级Pro"
  badge={{ text: 'PRO', variant: 'pro' }}
  onPress={() => router.push('/upgrade-pro')}
/>

// 意见反馈 (第 134 行)
<MenuItem icon="💬" iconBg={colors.creamDark} title="意见反馈" onPress={() => router.push('/feedback')} />

// 关于棉花记 (第 136 行)
<MenuItem icon="ℹ️" iconBg={colors.creamDark} title="关于棉花记" onPress={() => router.push('/about')} />
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(tabs)/profile.tsx
git commit -m "feat: wire profile menu items to new pages"
```

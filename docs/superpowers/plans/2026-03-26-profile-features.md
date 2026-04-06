# "我的"页面功能完善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将"我的"页面的 mock/静态功能替换为真实数据驱动——用户信息编辑、分类管理、预算设置扩展、我的账户。

**Architecture:** 离线优先，所有数据变更先写入本地 SQLite，UI 即时更新，Supabase 仅作后台同步。每个模块独立数据层（SQLite 表 + React Query hook），和现有 `useLocalTransactions`/`useLocalBudgets` 风格一致。

**Tech Stack:** React Native 0.83 + Expo SDK 55 + Expo Router + SQLite (expo-sqlite) + React Query v5 + Supabase

---

## File Structure

### New files

| File | Responsibility |
|------|-------------|
| `packages/shared/src/types/profile.ts` | UserProfile 类型定义 |
| `packages/shared/src/types/account.ts` | Account 类型定义 |
| `apps/mobile/hooks/useLocalProfile.ts` | Profile CRUD hook |
| `apps/mobile/hooks/useLocalAccounts.ts` | Account CRUD + 余额计算 hook |
| `apps/mobile/components/shared/EmojiPicker.tsx` | 共享 Emoji 选择器组件 |
| `apps/mobile/app/profile-edit.tsx` | 编辑头像和昵称页面 |
| `apps/mobile/app/category-manage.tsx` | 分类列表管理页面 |
| `apps/mobile/app/category-edit.tsx` | 添加/编辑分类页面 |
| `apps/mobile/app/budget-manage.tsx` | 预算列表管理页面 |
| `apps/mobile/app/budget-category-edit.tsx` | 添加/编辑分类预算页面 |
| `apps/mobile/app/accounts.tsx` | 账户列表页面 |
| `apps/mobile/app/account-edit.tsx` | 添加/编辑账户页面 |

### Modified files

| File | Changes |
|------|---------|
| `packages/shared/src/index.ts` | 导出新类型 |
| `packages/shared/src/types/category.ts` | 添加 `deleted_at` 字段 |
| `packages/shared/src/types/transaction.ts` | 添加 `account_id` 字段 |
| `apps/mobile/lib/db/schema.ts` | 新增 user_profiles、accounts 表 + ALTER 语句 |
| `apps/mobile/lib/db/index.ts` | 调用 migration |
| `apps/mobile/hooks/useLocalCategories.ts` | 添加 CRUD mutations + 软删除过滤 |
| `apps/mobile/hooks/useLocalBudgets.ts` | 添加 `useGlobalBudget`、`useCategoryBudgets` |
| `apps/mobile/hooks/useLocalTransactions.ts` | `CreateTransactionInput` 添加 `account_id` |
| `apps/mobile/components/profile/ProfileHeader.tsx` | 支持动态头像（emoji/image） |
| `apps/mobile/app/(tabs)/profile.tsx` | 菜单项添加 onPress 导航 + 使用 profile hook |
| `apps/mobile/app/manual-entry.tsx` | 新增账户选择项 |

---

## Task 1: 类型定义 — Profile 和 Account

**Files:**
- Create: `packages/shared/src/types/profile.ts`
- Create: `packages/shared/src/types/account.ts`
- Modify: `packages/shared/src/types/category.ts`
- Modify: `packages/shared/src/types/transaction.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: 创建 Profile 类型**

```typescript
// packages/shared/src/types/profile.ts
export type AvatarType = "emoji" | "image";

export interface UserProfile {
  readonly id: string;
  readonly nickname: string | null;
  readonly avatar_type: AvatarType;
  readonly avatar_value: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface UpdateProfileInput {
  readonly nickname?: string;
  readonly avatar_type?: AvatarType;
  readonly avatar_value?: string;
}
```

- [ ] **Step 2: 创建 Account 类型**

```typescript
// packages/shared/src/types/account.ts
export type AccountType = "cash" | "bank" | "e_wallet" | "credit" | "custom";

export interface Account {
  readonly id: string;
  readonly user_id: string | null;
  readonly name: string;
  readonly icon: string;
  readonly type: AccountType;
  readonly initial_balance: number;
  readonly created_at: string;
  readonly deleted_at: string | null;
}

export interface CreateAccountInput {
  readonly name: string;
  readonly icon: string;
  readonly type: AccountType;
  readonly initial_balance: number;
}

export interface UpdateAccountInput {
  readonly name?: string;
  readonly icon?: string;
  readonly type?: AccountType;
  readonly initial_balance?: number;
}
```

- [ ] **Step 3: 给 Category 类型添加 deleted_at**

在 `packages/shared/src/types/category.ts` 的 `Category` interface 中添加：

```typescript
export interface Category {
  readonly id: string;
  readonly user_id: string | null;
  readonly name: string;
  readonly icon: string;
  readonly type: TransactionType;
  readonly is_default: boolean;
  readonly deleted_at: string | null;  // 新增
}
```

- [ ] **Step 4: 给 Transaction 类型添加 account_id**

在 `packages/shared/src/types/transaction.ts` 中：

`Transaction` interface 添加：
```typescript
readonly account_id: string | null;  // 新增
```

`CreateTransactionInput` interface 添加：
```typescript
readonly account_id?: string | null;  // 新增
```

`UpdateTransactionInput` interface 添加：
```typescript
readonly account_id?: string | null;  // 新增
```

- [ ] **Step 5: 更新 shared 导出**

在 `packages/shared/src/index.ts` 末尾添加：

```typescript
export * from "./types/profile";
export * from "./types/account";
```

- [ ] **Step 6: 提交**

```bash
git add packages/shared/src/types/profile.ts packages/shared/src/types/account.ts packages/shared/src/types/category.ts packages/shared/src/types/transaction.ts packages/shared/src/index.ts
git commit -m "feat: add Profile and Account types, extend Category and Transaction"
```

---

## Task 2: 数据库 Schema 迁移

**Files:**
- Modify: `apps/mobile/lib/db/schema.ts`
- Modify: `apps/mobile/lib/db/index.ts`

- [ ] **Step 1: 添加新表和 migration 到 schema.ts**

在 `schema.ts` 中，在现有表定义之后添加：

```typescript
const CREATE_USER_PROFILES = `
  CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    nickname TEXT,
    avatar_type TEXT NOT NULL DEFAULT 'emoji',
    avatar_value TEXT NOT NULL DEFAULT '🌿',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

const CREATE_ACCOUNTS = `
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('cash', 'bank', 'e_wallet', 'credit', 'custom')),
    initial_balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    deleted_at TEXT
  );
`;
```

修改 `createTables` 函数，在末尾添加新表创建和 ALTER 语句：

```typescript
export async function createTables(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(CREATE_CATEGORIES);
  await db.execAsync(CREATE_TRANSACTIONS);
  await db.execAsync(CREATE_BUDGETS);
  await db.execAsync(CREATE_CHAT_MESSAGES);
  await db.execAsync(CREATE_USER_PROFILES);
  await db.execAsync(CREATE_ACCOUNTS);
  await runMigrations(db);
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // 给 categories 表添加 deleted_at 字段
  await addColumnIfNotExists(db, "categories", "deleted_at", "TEXT");
  // 给 transactions 表添加 account_id 字段
  await addColumnIfNotExists(db, "transactions", "account_id", "TEXT REFERENCES accounts(id)");
}

async function addColumnIfNotExists(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const info = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`
  );
  if (!info.some((col) => col.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
```

- [ ] **Step 2: 验证 initDatabase 无需修改**

`index.ts` 中的 `initDatabase` 已经调用 `createTables(db)`，新表和 migration 会自动在 App 启动时执行。无需修改此文件。

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/lib/db/schema.ts
git commit -m "feat: add user_profiles and accounts tables, add category deleted_at and transaction account_id columns"
```

---

## Task 3: useLocalProfile Hook

**Files:**
- Create: `apps/mobile/hooks/useLocalProfile.ts`

- [ ] **Step 1: 实现 useLocalProfile hook**

```typescript
// apps/mobile/hooks/useLocalProfile.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineContext } from "@/lib/offline-context";
import { useAuth } from "./useAuth";
import type { UserProfile, UpdateProfileInput } from "@coco/shared";

export function useProfile() {
  const { db } = useOfflineContext();
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!db || !userId) return null;
      return db.getFirstAsync<UserProfile>(
        "SELECT * FROM user_profiles WHERE id = ?",
        userId
      );
    },
    enabled: !!db && !!userId,
  });
}

export function useInitProfile() {
  const { db } = useOfflineContext();
  const { session } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!db || !session?.user) throw new Error("Database or session not available");
      const userId = session.user.id;

      const existing = await db.getFirstAsync<UserProfile>(
        "SELECT * FROM user_profiles WHERE id = ?",
        userId
      );
      if (existing) return existing;

      const nickname = session.user.email?.split("@")[0] ?? "棉花用户";
      const now = new Date().toISOString();
      await db.runAsync(
        "INSERT INTO user_profiles (id, nickname, avatar_type, avatar_value, created_at, updated_at) VALUES (?, ?, 'emoji', '🌿', ?, ?)",
        userId,
        nickname,
        now,
        now
      );
      return db.getFirstAsync<UserProfile>(
        "SELECT * FROM user_profiles WHERE id = ?",
        userId
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useUpdateProfile() {
  const { db } = useOfflineContext();
  const { session } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      if (!db || !session?.user) throw new Error("Database or session not available");
      const userId = session.user.id;
      const now = new Date().toISOString();

      const fields: string[] = ["updated_at = ?"];
      const values: (string | number)[] = [now];
      if (input.nickname !== undefined) { fields.push("nickname = ?"); values.push(input.nickname); }
      if (input.avatar_type !== undefined) { fields.push("avatar_type = ?"); values.push(input.avatar_type); }
      if (input.avatar_value !== undefined) { fields.push("avatar_value = ?"); values.push(input.avatar_value); }

      values.push(userId);
      await db.runAsync(
        `UPDATE user_profiles SET ${fields.join(", ")} WHERE id = ?`,
        ...values
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/hooks/useLocalProfile.ts
git commit -m "feat: add useLocalProfile hook with init/query/update"
```

---

## Task 4: Emoji 选择器共享组件

**Files:**
- Create: `apps/mobile/components/shared/EmojiPicker.tsx`

- [ ] **Step 1: 实现 EmojiPicker 组件**

```typescript
// apps/mobile/components/shared/EmojiPicker.tsx
import { useState } from "react";
import { View, TouchableOpacity, FlatList, TextInput, StyleSheet, Modal } from "react-native";
import { AppText } from "../ui/AppText";
import { colors, radii, spacing, shadows } from "../../constants/theme";

const EMOJI_GROUPS: Record<string, string[]> = {
  "常用": ["🍔", "🚗", "🛒", "🎮", "🏠", "💊", "📚", "📱", "💰", "📈", "💵", "📦", "🌿", "🎯", "🏷️"],
  "表情": ["😀", "😊", "😎", "🥳", "😍", "🤔", "😴", "🤑", "😇", "🥰", "😋", "🤓"],
  "食物": ["🍔", "🍕", "🍜", "🍣", "🍩", "☕", "🍺", "🧁", "🍇", "🥗", "🍰", "🧋"],
  "交通": ["🚗", "🚌", "🚀", "✈️", "🚲", "🛵", "🚇", "🚕", "⛵", "🏎️", "🚁", "🛴"],
  "物品": ["💰", "💳", "🏦", "💚", "💙", "🎒", "📱", "💻", "🎧", "📷", "🔑", "💎"],
  "自然": ["🌿", "🌸", "🌈", "⭐", "🌙", "☀️", "🍀", "🌻", "🌊", "🔥", "❄️", "🌺"],
  "活动": ["🎮", "⚽", "🏋️", "🎬", "🎵", "🎨", "📖", "🏕️", "🎲", "🧘", "🎭", "🎤"],
};

interface EmojiPickerProps {
  readonly visible: boolean;
  readonly onSelect: (emoji: string) => void;
  readonly onClose: () => void;
}

export function EmojiPicker({ visible, onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState("常用");

  const groups = Object.keys(EMOJI_GROUPS);
  const emojis = EMOJI_GROUPS[activeGroup] ?? [];

  const filteredEmojis = search ? Object.values(EMOJI_GROUPS).flat().filter((e, i, arr) => arr.indexOf(e) === i) : emojis;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* 标题栏 */}
          <View style={styles.header}>
            <AppText size="2xl" weight="semibold">选择图标</AppText>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <AppText size="2xl" color={colors.textLighter}>✕</AppText>
            </TouchableOpacity>
          </View>

          {/* 搜索（用于快速定位） */}
          <TextInput
            style={styles.search}
            placeholder="搜索 emoji..."
            placeholderTextColor={colors.textLighter}
            value={search}
            onChangeText={setSearch}
          />

          {/* 分组 Tab */}
          {!search && (
            <FlatList
              horizontal
              data={groups}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabBar}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.tab, item === activeGroup && styles.tabActive]}
                  onPress={() => setActiveGroup(item)}
                  activeOpacity={0.7}
                >
                  <AppText size="md" weight={item === activeGroup ? "semibold" : "regular"}
                    color={item === activeGroup ? colors.sage : colors.textLight}>
                    {item}
                  </AppText>
                </TouchableOpacity>
              )}
            />
          )}

          {/* Emoji 网格 */}
          <FlatList
            data={filteredEmojis}
            numColumns={6}
            keyExtractor={(item, index) => `${item}-${index}`}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.emojiCell}
                onPress={() => { onSelect(item); onClose(); setSearch(""); }}
                activeOpacity={0.6}
              >
                <AppText style={styles.emoji}>{item}</AppText>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    maxHeight: "70%",
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  search: {
    marginHorizontal: spacing.xxl,
    backgroundColor: colors.cream,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  tabBar: {
    paddingHorizontal: spacing.xxl,
    gap: 8,
    marginBottom: spacing.lg,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  tabActive: {
    backgroundColor: colors.sagePale,
  },
  grid: {
    paddingHorizontal: spacing.xxl,
  },
  emojiCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "16.666%",
  },
  emoji: {
    fontSize: 28,
  },
});
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/components/shared/EmojiPicker.tsx
git commit -m "feat: add shared EmojiPicker component"
```

---

## Task 5: ProfileHeader 改造 + Profile 编辑页面

**Files:**
- Modify: `apps/mobile/components/profile/ProfileHeader.tsx`
- Create: `apps/mobile/app/profile-edit.tsx`
- Modify: `apps/mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: 改造 ProfileHeader 支持动态头像**

修改 `apps/mobile/components/profile/ProfileHeader.tsx`：

```typescript
import { View, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../ui/AppText';
import { colors, shadows } from '../../constants/theme';
import type { AvatarType } from '@coco/shared';

interface ProfileHeaderProps {
  readonly name: string;
  readonly daysCount: number;
  readonly avatarType?: AvatarType;
  readonly avatarValue?: string;
  readonly onAvatarPress?: () => void;
  readonly onSettingsPress?: () => void;
}

export function ProfileHeader({ name, daysCount, avatarType = 'emoji', avatarValue = '🌿', onAvatarPress, onSettingsPress }: ProfileHeaderProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.settingsBtn} onPress={onSettingsPress} activeOpacity={0.7}>
        <AppText size="2xl">⚙️</AppText>
      </TouchableOpacity>
      <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.8}>
        <LinearGradient
          colors={[colors.sagePale, colors.coralPale]}
          style={styles.avatar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {avatarType === 'image' ? (
            <Image source={{ uri: avatarValue }} style={styles.avatarImage} />
          ) : (
            <AppText size="3xl">{avatarValue}</AppText>
          )}
        </LinearGradient>
      </TouchableOpacity>
      <AppText size="4xl" weight="bold" style={styles.name}>{name}</AppText>
      <AppText size="md" color={colors.textLighter} style={styles.subtitle}>
        已记账 {daysCount} 天
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: colors.cream,
  },
  settingsBtn: {
    position: 'absolute',
    top: 54,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 24,
  },
  name: {
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: 创建 Profile 编辑页面**

```typescript
// apps/mobile/app/profile-edit.tsx
import { useState, useEffect } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, Alert, Image, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useProfile, useUpdateProfile } from "../hooks/useLocalProfile";
import { EmojiPicker } from "../components/shared/EmojiPicker";
import { AppText } from "../components/ui/AppText";
import { colors, radii, spacing, shadows } from "../constants/theme";
import type { AvatarType } from "@coco/shared";

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const { mutateAsync: updateProfile } = useUpdateProfile();

  const [nickname, setNickname] = useState("");
  const [avatarType, setAvatarType] = useState<AvatarType>("emoji");
  const [avatarValue, setAvatarValue] = useState("🌿");
  const [submitting, setSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname ?? "");
      setAvatarType(profile.avatar_type);
      setAvatarValue(profile.avatar_value);
    }
  }, [profile?.id]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarType("image");
      setAvatarValue(result.assets[0].uri);
    }
  };

  const handleAvatarPress = () => {
    Alert.alert("更换头像", undefined, [
      { text: "选择 Emoji", onPress: () => setShowEmojiPicker(true) },
      { text: "从相册选择", onPress: handlePickImage },
      { text: "取消", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!nickname.trim()) {
      Alert.alert("昵称不能为空");
      return;
    }
    setSubmitting(true);
    try {
      await updateProfile({
        nickname: nickname.trim(),
        avatar_type: avatarType,
        avatar_value: avatarValue,
      });
      router.back();
    } catch {
      Alert.alert("保存失败", "请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">编辑资料</AppText>
        <TouchableOpacity onPress={handleSave} disabled={submitting} activeOpacity={0.7}>
          {submitting ? (
            <ActivityIndicator color={colors.sage} size="small" />
          ) : (
            <AppText size="xl" weight="semibold" color={colors.sage}>保存</AppText>
          )}
        </TouchableOpacity>
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8}>
          <LinearGradient
            colors={[colors.sagePale, colors.coralPale]}
            style={styles.avatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {avatarType === "image" ? (
              <Image source={{ uri: avatarValue }} style={styles.avatarImage} />
            ) : (
              <AppText style={{ fontSize: 40 }}>{avatarValue}</AppText>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <AppText size="md" color={colors.sage} style={{ marginTop: 8 }}>点击更换头像</AppText>
      </View>

      {/* Nickname input */}
      <View style={styles.fieldCard}>
        <AppText size="md" color={colors.textLighter} style={{ marginBottom: 6 }}>昵称</AppText>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={(text) => setNickname(text.slice(0, 20))}
          placeholder="输入昵称"
          placeholderTextColor={colors.textLighter}
          maxLength={20}
        />
        <AppText size="sm" color={colors.textLighter} style={{ marginTop: 4, textAlign: "right" }}>
          {nickname.length}/20
        </AppText>
      </View>

      <EmojiPicker
        visible={showEmojiPicker}
        onSelect={(emoji) => { setAvatarType("emoji"); setAvatarValue(emoji); }}
        onClose={() => setShowEmojiPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radii.sm,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  avatarSection: { alignItems: "center", paddingVertical: 32 },
  avatar: {
    width: 88, height: 88, borderRadius: 28,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImage: { width: 88, height: 88, borderRadius: 28 },
  fieldCard: {
    marginHorizontal: spacing.xxl, backgroundColor: colors.cream,
    borderRadius: radii.md, padding: spacing.xl,
  },
  input: { fontSize: 16, color: colors.text, fontWeight: "500" },
});
```

- [ ] **Step 3: 更新 profile.tsx 使用 profile hook + 添加导航**

修改 `apps/mobile/app/(tabs)/profile.tsx`：

在文件顶部添加导入：
```typescript
import { router } from 'expo-router';
import { useProfile, useInitProfile } from '../../hooks/useLocalProfile';
```

在 `ProfileScreen` 组件中，替换 `userName` 的计算逻辑，添加 profile 初始化：

```typescript
const { data: profile } = useProfile();
const { mutate: initProfile } = useInitProfile();

// 初始化 profile（首次使用）
useEffect(() => { initProfile(); }, []);

const userName = profile?.nickname ?? session?.user?.email?.split('@')[0] ?? '棉花用户';
```

添加 `useEffect` 的导入（如果还没有的话）。

更新 `ProfileHeader` 使用：
```typescript
<ProfileHeader
  name={userName}
  daysCount={streak}
  avatarType={profile?.avatar_type}
  avatarValue={profile?.avatar_value}
  onAvatarPress={() => router.push('/profile-edit')}
/>
```

更新菜单项添加 `onPress`：
```typescript
<MenuItem icon="💳" iconBg={colors.sagePale} title="我的账户" onPress={() => router.push('/accounts')} />
<MenuItem icon="🎯" iconBg={colors.honeyPale} title="预算设置" onPress={() => router.push('/budget-manage')} />
<MenuItem icon="🏷️" iconBg={colors.coralPale} title="分类管理" onPress={() => router.push('/category-manage')} />
```

- [ ] **Step 4: 提交**

```bash
git add apps/mobile/components/profile/ProfileHeader.tsx apps/mobile/app/profile-edit.tsx apps/mobile/app/\(tabs\)/profile.tsx
git commit -m "feat: add profile editing with avatar and nickname support"
```

---

## Task 6: 扩展 useLocalCategories — CRUD + 软删除

**Files:**
- Modify: `apps/mobile/hooks/useLocalCategories.ts`

- [ ] **Step 1: 添加软删除过滤 + CRUD mutations**

将 `apps/mobile/hooks/useLocalCategories.ts` 完整替换为：

```typescript
// apps/mobile/hooks/useLocalCategories.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useOfflineContext } from "@/lib/offline-context";
import type { Category, CreateCategoryInput } from "@coco/shared";

export function useLocalCategories() {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<readonly Category[]> => {
      if (!db) return [];
      const rows = await db.getAllAsync<Category>(
        "SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY type, name"
      );
      return rows.map((r) => ({ ...r, is_default: Boolean(r.is_default) }));
    },
    enabled: !!db,
  });
}

export function useCreateCategory() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      if (!db) throw new Error("Database not initialized");
      const id = Crypto.randomUUID();
      await db.runAsync(
        "INSERT INTO categories (id, user_id, name, icon, type, is_default) VALUES (?, NULL, ?, ?, ?, 0)",
        id,
        input.name,
        input.icon,
        input.type
      );
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useUpdateCategory() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { readonly id: string; readonly name: string; readonly icon: string }) => {
      if (!db) throw new Error("Database not initialized");
      await db.runAsync(
        "UPDATE categories SET name = ?, icon = ? WHERE id = ?",
        params.name,
        params.icon,
        params.id
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useDeleteCategory() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!db) throw new Error("Database not initialized");
      await db.runAsync(
        "UPDATE categories SET deleted_at = ? WHERE id = ? AND is_default = 0",
        new Date().toISOString(),
        id
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/hooks/useLocalCategories.ts
git commit -m "feat: extend useLocalCategories with CRUD mutations and soft delete"
```

---

## Task 7: 分类管理页面 + 编辑页面

**Files:**
- Create: `apps/mobile/app/category-manage.tsx`
- Create: `apps/mobile/app/category-edit.tsx`

- [ ] **Step 1: 创建分类管理列表页面**

```typescript
// apps/mobile/app/category-manage.tsx
import { useState } from "react";
import { View, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalCategories, useDeleteCategory } from "../hooks/useLocalCategories";
import { AppText } from "../components/ui/AppText";
import { colors, radii, spacing, shadows } from "../constants/theme";
import type { TransactionType } from "@coco/shared";

export default function CategoryManageScreen() {
  const insets = useSafeAreaInsets();
  const { data: categories = [] } = useLocalCategories();
  const { mutateAsync: deleteCategory } = useDeleteCategory();
  const [activeTab, setActiveTab] = useState<TransactionType>("expense");

  const filtered = categories.filter((c) => c.type === activeTab);

  const handleDelete = (id: string, name: string) => {
    Alert.alert("删除分类", `确定要删除"${name}"吗？已有的交易记录不会受影响。`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => deleteCategory(id) },
    ]);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">分类管理</AppText>
        <View style={{ width: 36 }} />
      </View>

      {/* Tab */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "expense" && styles.tabActiveExpense]}
          onPress={() => setActiveTab("expense")}
          activeOpacity={0.7}
        >
          <AppText size="xl" weight="semibold" color={activeTab === "expense" ? colors.white : colors.textLight}>
            支出
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "income" && styles.tabActiveIncome]}
          onPress={() => setActiveTab("income")}
          activeOpacity={0.7}
        >
          <AppText size="xl" weight="semibold" color={activeTab === "income" ? colors.white : colors.textLight}>
            收入
          </AppText>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.rowContent}
              onPress={() => router.push({ pathname: "/category-edit", params: { id: item.id, name: item.name, icon: item.icon, type: item.type } })}
              activeOpacity={0.7}
            >
              <View style={styles.iconBox}>
                <AppText style={{ fontSize: 24 }}>{item.icon}</AppText>
              </View>
              <AppText size="xl" weight="medium" style={{ flex: 1 }}>{item.name}</AppText>
              {item.is_default && (
                <AppText size="sm" color={colors.textLighter}>预设</AppText>
              )}
              <AppText size="xl" color={colors.textLighter}>›</AppText>
            </TouchableOpacity>
            {!item.is_default && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item.id, item.name)}
                activeOpacity={0.7}
              >
                <AppText size="md" color="#DC2626">删除</AppText>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {/* Add button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push({ pathname: "/category-edit", params: { type: activeTab } })}
          activeOpacity={0.8}
        >
          <AppText size="2xl" weight="semibold" color={colors.white}>+ 添加分类</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radii.sm,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  tabRow: { flexDirection: "row", gap: 12, padding: spacing.xl },
  tab: {
    flex: 1, paddingVertical: 12, borderRadius: radii.md,
    backgroundColor: colors.creamDark, alignItems: "center",
  },
  tabActiveExpense: { backgroundColor: colors.coral },
  tabActiveIncome: { backgroundColor: colors.sage },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
  row: {
    backgroundColor: colors.white, borderRadius: radii.md,
    marginBottom: spacing.md, ...shadows.sm, overflow: "hidden",
  },
  rowContent: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: spacing.xl,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: radii.md,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  deleteBtn: {
    borderTopWidth: 1, borderTopColor: colors.creamDark,
    paddingVertical: 10, alignItems: "center",
  },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.xl, paddingTop: 12,
    backgroundColor: colors.cream,
  },
  addBtn: {
    height: 48, borderRadius: radii.md, backgroundColor: colors.sage,
    alignItems: "center", justifyContent: "center", ...shadows.md,
  },
});
```

- [ ] **Step 2: 创建分类编辑/添加页面**

```typescript
// apps/mobile/app/category-edit.tsx
import { useState, useEffect } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCreateCategory, useUpdateCategory } from "../hooks/useLocalCategories";
import { EmojiPicker } from "../components/shared/EmojiPicker";
import { AppText } from "../components/ui/AppText";
import { colors, radii, spacing } from "../constants/theme";
import type { TransactionType } from "@coco/shared";

export default function CategoryEditScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; name?: string; icon?: string; type?: string }>();
  const isEdit = !!params.id;

  const { mutateAsync: createCategory } = useCreateCategory();
  const { mutateAsync: updateCategory } = useUpdateCategory();

  const [name, setName] = useState(params.name ?? "");
  const [icon, setIcon] = useState(params.icon ?? "📦");
  const [type, setType] = useState<TransactionType>((params.type as TransactionType) ?? "expense");
  const [submitting, setSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("请输入分类名称");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateCategory({ id: params.id!, name: name.trim(), icon });
      } else {
        await createCategory({ name: name.trim(), icon, type });
      }
      router.back();
    } catch {
      Alert.alert("保存失败", "请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">{isEdit ? "编辑分类" : "添加分类"}</AppText>
        <TouchableOpacity onPress={handleSave} disabled={submitting} activeOpacity={0.7}>
          {submitting ? (
            <ActivityIndicator color={colors.sage} size="small" />
          ) : (
            <AppText size="xl" weight="semibold" color={colors.sage}>保存</AppText>
          )}
        </TouchableOpacity>
      </View>

      {/* Icon */}
      <View style={styles.iconSection}>
        <TouchableOpacity onPress={() => setShowEmojiPicker(true)} activeOpacity={0.8}>
          <View style={styles.iconPreview}>
            <AppText style={{ fontSize: 40 }}>{icon}</AppText>
          </View>
        </TouchableOpacity>
        <AppText size="md" color={colors.sage} style={{ marginTop: 8 }}>点击更换图标</AppText>
      </View>

      {/* Fields */}
      <View style={styles.fieldCard}>
        <AppText size="md" color={colors.textLighter} style={{ marginBottom: 6 }}>分类名称</AppText>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="输入分类名称"
          placeholderTextColor={colors.textLighter}
          maxLength={10}
        />
      </View>

      {/* Type selector (only for new categories) */}
      {!isEdit && (
        <View style={styles.typeSection}>
          <AppText size="md" color={colors.textLighter} style={{ marginBottom: 10, marginHorizontal: spacing.xxl }}>类型</AppText>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeBtn, type === "expense" && { backgroundColor: colors.coral }]}
              onPress={() => setType("expense")}
              activeOpacity={0.7}
            >
              <AppText size="xl" weight="semibold" color={type === "expense" ? colors.white : colors.textLight}>支出</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, type === "income" && { backgroundColor: colors.sage }]}
              onPress={() => setType("income")}
              activeOpacity={0.7}
            >
              <AppText size="xl" weight="semibold" color={type === "income" ? colors.white : colors.textLight}>收入</AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <EmojiPicker
        visible={showEmojiPicker}
        onSelect={setIcon}
        onClose={() => setShowEmojiPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radii.sm,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  iconSection: { alignItems: "center", paddingVertical: 28 },
  iconPreview: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  fieldCard: {
    marginHorizontal: spacing.xxl, backgroundColor: colors.cream,
    borderRadius: radii.md, padding: spacing.xl,
  },
  input: { fontSize: 16, color: colors.text, fontWeight: "500" },
  typeSection: { marginTop: spacing.xxl },
  typeRow: { flexDirection: "row", gap: 12, paddingHorizontal: spacing.xxl },
  typeBtn: {
    flex: 1, paddingVertical: 14, borderRadius: radii.md,
    backgroundColor: colors.cream, alignItems: "center",
  },
});
```

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/app/category-manage.tsx apps/mobile/app/category-edit.tsx
git commit -m "feat: add category management and edit screens"
```

---

## Task 8: 扩展 useLocalBudgets — 分组查询

**Files:**
- Modify: `apps/mobile/hooks/useLocalBudgets.ts`

- [ ] **Step 1: 添加 useGlobalBudget 和 useCategoryBudgets**

在 `apps/mobile/hooks/useLocalBudgets.ts` 文件末尾，`useDeleteBudget` 之后，添加：

```typescript
export function useGlobalBudget() {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["budgets", "global"],
    queryFn: async (): Promise<Budget | null> => {
      if (!db) return null;
      return db.getFirstAsync<Budget>(
        "SELECT * FROM budgets WHERE category_id IS NULL AND period = 'monthly' ORDER BY start_date DESC LIMIT 1"
      );
    },
    enabled: !!db,
  });
}

export function useCategoryBudgets() {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["budgets", "category"],
    queryFn: async (): Promise<readonly Budget[]> => {
      if (!db) return [];
      return db.getAllAsync<Budget>(
        "SELECT * FROM budgets WHERE category_id IS NOT NULL AND period = 'monthly' ORDER BY start_date DESC"
      );
    },
    enabled: !!db,
  });
}
```

同时更新文件顶部的导入（如果 `Budget` 类型还没被导入的话已经在了，确认无需改动）。

更新所有 mutation 的 `onSuccess` 回调，让它们同时 invalidate 子查询：

在 `useCreateBudget`、`useUpdateBudget`、`useDeleteBudget` 的 `onSuccess` 中，将 `qc.invalidateQueries({ queryKey: ["budgets"] });` 保持不变即可（因为 `["budgets"]` 前缀匹配会自动 invalidate `["budgets", "global"]` 和 `["budgets", "category"]`）。

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/hooks/useLocalBudgets.ts
git commit -m "feat: add useGlobalBudget and useCategoryBudgets hooks"
```

---

## Task 9: 预算管理页面 + 分类预算编辑页面

**Files:**
- Create: `apps/mobile/app/budget-manage.tsx`
- Create: `apps/mobile/app/budget-category-edit.tsx`

- [ ] **Step 1: 创建预算管理列表页面**

```typescript
// apps/mobile/app/budget-manage.tsx
import { View, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGlobalBudget, useCategoryBudgets, useDeleteBudget } from "../hooks/useLocalBudgets";
import { useLocalCategories } from "../hooks/useLocalCategories";
import { useMonthlyTransactions } from "../hooks/useLocalTransactions";
import { AppText } from "../components/ui/AppText";
import { Card } from "../components/ui/Card";
import { colors, radii, spacing, shadows } from "../constants/theme";

export default function BudgetManageScreen() {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const { data: globalBudget } = useGlobalBudget();
  const { data: categoryBudgets = [] } = useCategoryBudgets();
  const { data: categories = [] } = useLocalCategories();
  const { data: monthlyTx = [] } = useMonthlyTransactions(now.getFullYear(), now.getMonth());
  const { mutateAsync: deleteBudget } = useDeleteBudget();

  const totalExpense = monthlyTx
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const getCategoryExpense = (categoryId: string) =>
    monthlyTx
      .filter((t) => t.type === "expense" && t.category_id === categoryId)
      .reduce((sum, t) => sum + t.amount, 0);

  const getCategoryInfo = (categoryId: string | null) =>
    categories.find((c) => c.id === categoryId);

  const handleDeleteBudget = (id: string, name: string) => {
    Alert.alert("删除预算", `确定要删除"${name}"的预算吗？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => deleteBudget(id) },
    ]);
  };

  const globalProgress = globalBudget ? Math.min(totalExpense / globalBudget.amount, 1) : 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">预算设置</AppText>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={categoryBudgets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Global budget card */}
            <TouchableOpacity onPress={() => router.push("/budget-setting")} activeOpacity={0.8}>
              <Card style={styles.globalCard}>
                <AppText size="md" color={colors.textLighter}>总预算 (月)</AppText>
                <AppText size="5xl" weight="bold" style={{ marginTop: 4 }}>
                  {globalBudget ? `¥ ${globalBudget.amount.toLocaleString()}` : "点击设置"}
                </AppText>
                {globalBudget && (
                  <>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${globalProgress * 100}%` }]} />
                    </View>
                    <AppText size="sm" color={colors.textLighter} style={{ marginTop: 4 }}>
                      已用 ¥{totalExpense.toFixed(0)} / ¥{globalBudget.amount.toFixed(0)}
                    </AppText>
                  </>
                )}
              </Card>
            </TouchableOpacity>

            <AppText size="xl" weight="semibold" color={colors.textLight} style={styles.sectionTitle}>
              分类预算
            </AppText>
          </>
        }
        renderItem={({ item }) => {
          const cat = getCategoryInfo(item.category_id);
          const spent = item.category_id ? getCategoryExpense(item.category_id) : 0;
          const progress = Math.min(spent / item.amount, 1);
          return (
            <TouchableOpacity
              style={styles.budgetRow}
              onPress={() => router.push({ pathname: "/budget-category-edit", params: { id: item.id, categoryId: item.category_id ?? "", amount: String(item.amount) } })}
              onLongPress={() => handleDeleteBudget(item.id, cat?.name ?? "未知")}
              activeOpacity={0.7}
            >
              <View style={styles.budgetIcon}>
                <AppText style={{ fontSize: 22 }}>{cat?.icon ?? "📦"}</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.budgetInfo}>
                  <AppText size="xl" weight="medium">{cat?.name ?? "未知分类"}</AppText>
                  <AppText size="md" color={colors.textLight}>¥{spent.toFixed(0)} / ¥{item.amount.toFixed(0)}</AppText>
                </View>
                <View style={styles.progressTrackSmall}>
                  <View style={[styles.progressFillSmall, { width: `${progress * 100}%` }]} />
                </View>
              </View>
              <AppText size="xl" color={colors.textLighter}>›</AppText>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/budget-category-edit")}
            activeOpacity={0.8}
          >
            <AppText size="2xl" weight="semibold" color={colors.white}>+ 添加分类预算</AppText>
          </TouchableOpacity>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radii.sm,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  listContent: { padding: spacing.xl, paddingBottom: 40 },
  globalCard: { marginBottom: spacing.xl },
  progressTrack: {
    height: 6, backgroundColor: colors.creamDark, borderRadius: 3, marginTop: 12,
  },
  progressFill: {
    height: 6, borderRadius: 3, backgroundColor: colors.sage,
  },
  sectionTitle: { marginBottom: spacing.lg },
  budgetRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.white, borderRadius: radii.md,
    padding: spacing.xl, marginBottom: spacing.md, ...shadows.sm,
  },
  budgetIcon: {
    width: 40, height: 40, borderRadius: radii.md,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  budgetInfo: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6,
  },
  progressTrackSmall: {
    height: 4, backgroundColor: colors.creamDark, borderRadius: 2,
  },
  progressFillSmall: {
    height: 4, borderRadius: 2, backgroundColor: colors.honey,
  },
  addBtn: {
    height: 48, borderRadius: radii.md, backgroundColor: colors.sage,
    alignItems: "center", justifyContent: "center", marginTop: spacing.lg, ...shadows.md,
  },
});
```

- [ ] **Step 2: 创建分类预算编辑页面**

```typescript
// apps/mobile/app/budget-category-edit.tsx
import { useState, useRef, useEffect } from "react";
import { View, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator, Keyboard } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCreateBudget, useUpdateBudget } from "../hooks/useLocalBudgets";
import { useLocalCategories } from "../hooks/useLocalCategories";
import { useCategoryBudgets } from "../hooks/useLocalBudgets";
import { AppText } from "../components/ui/AppText";
import { colors, radii, spacing, shadows } from "../constants/theme";

export default function BudgetCategoryEditScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; categoryId?: string; amount?: string }>();
  const isEdit = !!params.id;

  const { data: categories = [] } = useLocalCategories();
  const { data: existingBudgets = [] } = useCategoryBudgets();
  const { mutateAsync: createBudget } = useCreateBudget();
  const { mutateAsync: updateBudget } = useUpdateBudget();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(params.categoryId || null);
  const [amount, setAmount] = useState(params.amount ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const amountRef = useRef<TextInput>(null);

  // 过滤掉已有预算的分类（编辑时排除自身）
  const usedCategoryIds = new Set(
    existingBudgets.filter((b) => b.id !== params.id).map((b) => b.category_id)
  );
  const availableCategories = categories.filter(
    (c) => c.type === "expense" && !usedCategoryIds.has(c.id)
  );

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("请输入有效金额");
      return;
    }
    if (!isEdit && !selectedCategoryId) {
      Alert.alert("请选择分类");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateBudget({ id: params.id!, amount: numAmount });
      } else {
        const now = new Date();
        await createBudget({
          category_id: selectedCategoryId,
          amount: numAmount,
          period: "monthly",
          start_date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        });
      }
      router.back();
    } catch {
      Alert.alert("保存失败", "请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">{isEdit ? "编辑分类预算" : "添加分类预算"}</AppText>
        <View style={{ width: 36 }} />
      </View>

      {/* Category selector (only for new) */}
      {!isEdit && (
        <View style={styles.section}>
          <AppText size="md" color={colors.textLighter} style={{ marginBottom: 10 }}>选择分类</AppText>
          <FlatList
            horizontal
            data={availableCategories}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.categoryChip, item.id === selectedCategoryId && styles.categoryChipActive]}
                onPress={() => setSelectedCategoryId(item.id)}
                activeOpacity={0.7}
              >
                <AppText style={{ fontSize: 20 }}>{item.icon}</AppText>
                <AppText size="md" weight="medium"
                  color={item.id === selectedCategoryId ? colors.white : colors.text}>
                  {item.name}
                </AppText>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Amount */}
      <View style={styles.section}>
        <AppText size="md" color={colors.textLighter} style={{ marginBottom: 10 }}>预算金额</AppText>
        <View style={styles.amountBox}>
          <AppText style={styles.amountPrefix}>¥</AppText>
          <TextInput
            ref={amountRef}
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={colors.textLighter}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {/* Save button */}
      <View style={[styles.bottomBar, { paddingBottom: (keyboardHeight > 0 ? keyboardHeight + 16 : insets.bottom) + 12 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <AppText size="2xl" weight="semibold" color={colors.white}>保存</AppText>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radii.sm,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  section: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  categoryChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radii.md, backgroundColor: colors.cream,
  },
  categoryChipActive: { backgroundColor: colors.sage },
  amountBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.cream, borderRadius: radii.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
  },
  amountPrefix: { fontSize: 28, fontWeight: "700", color: colors.textLighter, marginRight: 4 },
  amountInput: { flex: 1, fontSize: 36, fontWeight: "700", color: colors.text },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.xl, paddingTop: 12,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.creamDark,
  },
  saveBtn: {
    height: 48, borderRadius: radii.md, backgroundColor: colors.sage,
    alignItems: "center", justifyContent: "center", ...shadows.md,
  },
});
```

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/app/budget-manage.tsx apps/mobile/app/budget-category-edit.tsx
git commit -m "feat: add budget management and category budget edit screens"
```

---

## Task 10: useLocalAccounts Hook

**Files:**
- Create: `apps/mobile/hooks/useLocalAccounts.ts`

- [ ] **Step 1: 实现 useLocalAccounts hook**

```typescript
// apps/mobile/hooks/useLocalAccounts.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useOfflineContext } from "@/lib/offline-context";
import type { Account, CreateAccountInput, UpdateAccountInput } from "@coco/shared";

export function useAccounts() {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["accounts"],
    queryFn: async (): Promise<readonly Account[]> => {
      if (!db) return [];
      return db.getAllAsync<Account>(
        "SELECT * FROM accounts WHERE deleted_at IS NULL ORDER BY created_at ASC"
      );
    },
    enabled: !!db,
  });
}

export function useAccountBalance(accountId: string | undefined) {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["account-balance", accountId],
    queryFn: async (): Promise<number> => {
      if (!db || !accountId) return 0;

      const account = await db.getFirstAsync<Account>(
        "SELECT * FROM accounts WHERE id = ?",
        accountId
      );
      if (!account) return 0;

      const income = await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = 'income' AND deleted_at IS NULL",
        accountId
      );
      const expense = await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = 'expense' AND deleted_at IS NULL",
        accountId
      );
      return account.initial_balance + (income?.total ?? 0) - (expense?.total ?? 0);
    },
    enabled: !!db && !!accountId,
  });
}

export function useTotalAssets() {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["total-assets"],
    queryFn: async (): Promise<number> => {
      if (!db) return 0;

      const accounts = await db.getAllAsync<Account>(
        "SELECT * FROM accounts WHERE deleted_at IS NULL"
      );

      let total = 0;
      for (const account of accounts) {
        const income = await db.getFirstAsync<{ total: number }>(
          "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = 'income' AND deleted_at IS NULL",
          account.id
        );
        const expense = await db.getFirstAsync<{ total: number }>(
          "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = 'expense' AND deleted_at IS NULL",
          account.id
        );
        total += account.initial_balance + (income?.total ?? 0) - (expense?.total ?? 0);
      }
      return total;
    },
    enabled: !!db,
  });
}

export function useCreateAccount() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAccountInput) => {
      if (!db) throw new Error("Database not initialized");
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      await db.runAsync(
        "INSERT INTO accounts (id, user_id, name, icon, type, initial_balance, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?)",
        id,
        input.name,
        input.icon,
        input.type,
        input.initial_balance,
        now
      );
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["total-assets"] });
    },
  });
}

export function useUpdateAccount() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateAccountInput & { readonly id: string }) => {
      if (!db) throw new Error("Database not initialized");
      const fields: string[] = [];
      const values: (string | number)[] = [];
      if (params.name !== undefined) { fields.push("name = ?"); values.push(params.name); }
      if (params.icon !== undefined) { fields.push("icon = ?"); values.push(params.icon); }
      if (params.type !== undefined) { fields.push("type = ?"); values.push(params.type); }
      if (params.initial_balance !== undefined) { fields.push("initial_balance = ?"); values.push(params.initial_balance); }
      if (fields.length === 0) return;
      values.push(params.id);
      await db.runAsync(
        `UPDATE accounts SET ${fields.join(", ")} WHERE id = ?`,
        ...values
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["account-balance"] });
      qc.invalidateQueries({ queryKey: ["total-assets"] });
    },
  });
}

export function useDeleteAccount() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!db) throw new Error("Database not initialized");
      await db.runAsync(
        "UPDATE accounts SET deleted_at = ? WHERE id = ?",
        new Date().toISOString(),
        id
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["total-assets"] });
    },
  });
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/hooks/useLocalAccounts.ts
git commit -m "feat: add useLocalAccounts hook with balance calculation"
```

---

## Task 11: 账户列表页面 + 编辑页面

**Files:**
- Create: `apps/mobile/app/accounts.tsx`
- Create: `apps/mobile/app/account-edit.tsx`

- [ ] **Step 1: 创建账户列表页面**

```typescript
// apps/mobile/app/accounts.tsx
import { View, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAccounts, useTotalAssets, useDeleteAccount } from "../hooks/useLocalAccounts";
import { useOfflineContext } from "../lib/offline-context";
import { useQuery } from "@tanstack/react-query";
import { AppText } from "../components/ui/AppText";
import { colors, radii, spacing, shadows } from "../constants/theme";
import type { Account } from "@coco/shared";

function useAccountBalanceInline(db: any, accountId: string) {
  return useQuery({
    queryKey: ["account-balance", accountId],
    queryFn: async (): Promise<number> => {
      if (!db) return 0;
      const account = await db.getFirstAsync<Account>("SELECT * FROM accounts WHERE id = ?", accountId);
      if (!account) return 0;
      const income = await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = 'income' AND deleted_at IS NULL",
        accountId
      );
      const expense = await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = 'expense' AND deleted_at IS NULL",
        accountId
      );
      return account.initial_balance + (income?.total ?? 0) - (expense?.total ?? 0);
    },
    enabled: !!db,
  });
}

function AccountRow({ account }: { readonly account: Account }) {
  const { db } = useOfflineContext();
  const { data: balance = 0 } = useAccountBalanceInline(db, account.id);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push({ pathname: "/account-edit", params: { id: account.id, name: account.name, icon: account.icon, type: account.type, initialBalance: String(account.initial_balance) } })}
      activeOpacity={0.7}
    >
      <View style={styles.rowIcon}>
        <AppText style={{ fontSize: 24 }}>{account.icon}</AppText>
      </View>
      <View style={{ flex: 1 }}>
        <AppText size="xl" weight="medium">{account.name}</AppText>
        <AppText size="sm" color={colors.textLighter}>{account.type}</AppText>
      </View>
      <AppText size="xl" weight="semibold">¥ {balance.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</AppText>
      <AppText size="xl" color={colors.textLighter} style={{ marginLeft: 8 }}>›</AppText>
    </TouchableOpacity>
  );
}

export default function AccountsScreen() {
  const insets = useSafeAreaInsets();
  const { data: accounts = [] } = useAccounts();
  const { data: totalAssets = 0 } = useTotalAssets();
  const { mutateAsync: deleteAccount } = useDeleteAccount();

  const handleDelete = (id: string, name: string) => {
    Alert.alert("删除账户", `确定要删除"${name}"吗？已有的交易记录不会受影响。`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => deleteAccount(id) },
    ]);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">我的账户</AppText>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <LinearGradient
            colors={[colors.sage, "#6b9a7a"]}
            style={styles.totalCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <AppText size="md" color="rgba(255,255,255,0.85)">总资产</AppText>
            <AppText size="6xl" weight="bold" color={colors.white} style={{ marginTop: 4 }}>
              ¥ {totalAssets.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </AppText>
          </LinearGradient>
        }
        renderItem={({ item }) => <AccountRow account={item} />}
        ListFooterComponent={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/account-edit")}
            activeOpacity={0.8}
          >
            <AppText size="2xl" weight="semibold" color={colors.white}>+ 添加账户</AppText>
          </TouchableOpacity>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radii.sm,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  listContent: { padding: spacing.xl, paddingBottom: 40 },
  totalCard: {
    borderRadius: radii.lg, padding: spacing.xxl, marginBottom: spacing.xl,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.white, borderRadius: radii.md,
    padding: spacing.xl, marginBottom: spacing.md, ...shadows.sm,
  },
  rowIcon: {
    width: 44, height: 44, borderRadius: radii.md,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  addBtn: {
    height: 48, borderRadius: radii.md, backgroundColor: colors.sage,
    alignItems: "center", justifyContent: "center", marginTop: spacing.lg, ...shadows.md,
  },
});
```

- [ ] **Step 2: 创建账户编辑页面**

```typescript
// apps/mobile/app/account-edit.tsx
import { useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCreateAccount, useUpdateAccount } from "../hooks/useLocalAccounts";
import { EmojiPicker } from "../components/shared/EmojiPicker";
import { AppText } from "../components/ui/AppText";
import { colors, radii, spacing, shadows } from "../constants/theme";
import type { AccountType } from "@coco/shared";

const PRESETS: { name: string; icon: string; type: AccountType }[] = [
  { name: "现金", icon: "💰", type: "cash" },
  { name: "银行卡", icon: "🏦", type: "bank" },
  { name: "微信", icon: "💚", type: "e_wallet" },
  { name: "支付宝", icon: "💙", type: "e_wallet" },
  { name: "信用卡", icon: "💳", type: "credit" },
];

const TYPE_LABELS: Record<AccountType, string> = {
  cash: "现金", bank: "银行卡", e_wallet: "电子钱包", credit: "信用卡", custom: "自定义",
};

export default function AccountEditScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; name?: string; icon?: string; type?: string; initialBalance?: string }>();
  const isEdit = !!params.id;

  const { mutateAsync: createAccount } = useCreateAccount();
  const { mutateAsync: updateAccount } = useUpdateAccount();

  const [name, setName] = useState(params.name ?? "");
  const [icon, setIcon] = useState(params.icon ?? "💰");
  const [type, setType] = useState<AccountType>((params.type as AccountType) ?? "cash");
  const [initialBalance, setInitialBalance] = useState(params.initialBalance ?? "0");
  const [submitting, setSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handlePreset = (preset: typeof PRESETS[0]) => {
    setName(preset.name);
    setIcon(preset.icon);
    setType(preset.type);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("请输入账户名称");
      return;
    }
    const numBalance = parseFloat(initialBalance);
    if (isNaN(numBalance)) {
      Alert.alert("请输入有效金额");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateAccount({ id: params.id!, name: name.trim(), icon, type, initial_balance: numBalance });
      } else {
        await createAccount({ name: name.trim(), icon, type, initial_balance: numBalance });
      }
      router.back();
    } catch {
      Alert.alert("保存失败", "请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">{isEdit ? "编辑账户" : "添加账户"}</AppText>
        <TouchableOpacity onPress={handleSave} disabled={submitting} activeOpacity={0.7}>
          {submitting ? (
            <ActivityIndicator color={colors.sage} size="small" />
          ) : (
            <AppText size="xl" weight="semibold" color={colors.sage}>保存</AppText>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        {/* Presets (only for new) */}
        {!isEdit && (
          <View style={styles.section}>
            <AppText size="md" color={colors.textLighter} style={{ marginBottom: 10 }}>快速添加</AppText>
            <View style={styles.presetRow}>
              {PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.name}
                  style={[styles.presetChip, name === p.name && styles.presetChipActive]}
                  onPress={() => handlePreset(p)}
                  activeOpacity={0.7}
                >
                  <AppText style={{ fontSize: 18 }}>{p.icon}</AppText>
                  <AppText size="md" weight="medium"
                    color={name === p.name ? colors.white : colors.text}>
                    {p.name}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Icon */}
        <View style={styles.iconSection}>
          <TouchableOpacity onPress={() => setShowEmojiPicker(true)} activeOpacity={0.8}>
            <View style={styles.iconPreview}>
              <AppText style={{ fontSize: 36 }}>{icon}</AppText>
            </View>
          </TouchableOpacity>
          <AppText size="md" color={colors.sage} style={{ marginTop: 8 }}>点击更换图标</AppText>
        </View>

        {/* Fields */}
        <View style={styles.fieldCard}>
          {/* Name */}
          <View style={styles.field}>
            <AppText size="md" color={colors.textLighter} style={{ marginBottom: 6 }}>账户名称</AppText>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="输入账户名称"
              placeholderTextColor={colors.textLighter}
              maxLength={20}
            />
          </View>

          <View style={styles.fieldSep} />

          {/* Type */}
          <View style={styles.field}>
            <AppText size="md" color={colors.textLighter} style={{ marginBottom: 6 }}>账户类型</AppText>
            <View style={styles.typeRow}>
              {(Object.keys(TYPE_LABELS) as AccountType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, type === t && styles.typeChipActive]}
                  onPress={() => setType(t)}
                  activeOpacity={0.7}
                >
                  <AppText size="sm" weight="medium"
                    color={type === t ? colors.white : colors.textLight}>
                    {TYPE_LABELS[t]}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldSep} />

          {/* Initial balance */}
          <View style={styles.field}>
            <AppText size="md" color={colors.textLighter} style={{ marginBottom: 6 }}>初始余额</AppText>
            <View style={styles.balanceRow}>
              <AppText style={{ fontSize: 20, fontWeight: "700", color: colors.textLighter }}>¥</AppText>
              <TextInput
                style={styles.balanceInput}
                value={initialBalance}
                onChangeText={setInitialBalance}
                placeholder="0.00"
                placeholderTextColor={colors.textLighter}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <EmojiPicker
        visible={showEmojiPicker}
        onSelect={setIcon}
        onClose={() => setShowEmojiPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radii.sm,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  body: { flex: 1 },
  section: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xxl },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  presetChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radii.md, backgroundColor: colors.cream,
  },
  presetChipActive: { backgroundColor: colors.sage },
  iconSection: { alignItems: "center", paddingVertical: 24 },
  iconPreview: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
    ...shadows.sm,
  },
  fieldCard: {
    marginHorizontal: spacing.xxl, backgroundColor: colors.cream,
    borderRadius: radii.md, overflow: "hidden",
  },
  field: { padding: spacing.xl },
  fieldSep: { height: 1, backgroundColor: colors.creamDark, marginHorizontal: spacing.xl },
  input: { fontSize: 16, color: colors.text, fontWeight: "500" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radii.sm, backgroundColor: colors.white,
  },
  typeChipActive: { backgroundColor: colors.sage },
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  balanceInput: { flex: 1, fontSize: 24, fontWeight: "700", color: colors.text },
});
```

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/app/accounts.tsx apps/mobile/app/account-edit.tsx
git commit -m "feat: add accounts list and account edit screens"
```

---

## Task 12: 记账页添加账户选择 + Transaction 类型适配

**Files:**
- Modify: `apps/mobile/app/manual-entry.tsx`
- Modify: `apps/mobile/hooks/useLocalTransactions.ts`

- [ ] **Step 1: 更新 useCreateTransaction 支持 account_id**

在 `apps/mobile/hooks/useLocalTransactions.ts` 的 `useCreateTransaction` 中：

修改 INSERT 语句，在字段列表末尾添加 `account_id`：

```typescript
mutationFn: async (input: CreateTransactionInput): Promise<string> => {
  if (!db) throw new Error("Database not initialized");
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO transactions (id, user_id, category_id, amount, type, note, occurred_at, source, raw_input, receipt_url, ai_confidence, created_at, account_id)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.category_id,
    input.amount,
    input.type,
    input.note,
    input.occurred_at,
    input.source ?? "manual",
    input.raw_input ?? null,
    input.receipt_url ?? null,
    input.ai_confidence ?? null,
    now,
    input.account_id ?? null
  );
  return id;
},
```

同时在 `onSuccess` 中添加 account-balance 的 invalidation：
```typescript
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ["transactions"] });
  qc.invalidateQueries({ queryKey: ["account-balance"] });
  qc.invalidateQueries({ queryKey: ["total-assets"] });
},
```

在 `useUpdateTransaction` 的 `mutationFn` 中，添加 `account_id` 字段支持：
```typescript
if (params.account_id !== undefined) { fields.push("account_id = ?"); values.push(params.account_id as any); }
```

同理更新 `useUpdateTransaction` 和 `useDeleteTransaction` 的 `onSuccess`：
```typescript
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ["transactions"] });
  qc.invalidateQueries({ queryKey: ["account-balance"] });
  qc.invalidateQueries({ queryKey: ["total-assets"] });
},
```

- [ ] **Step 2: 在记账页添加账户选择**

在 `apps/mobile/app/manual-entry.tsx` 中：

添加导入：
```typescript
import { useAccounts } from "../hooks/useLocalAccounts";
```

在组件中添加 state 和 hook：
```typescript
const { data: accounts = [] } = useAccounts();
const [accountId, setAccountId] = useState<string | null>(null);
```

在编辑模式的 `useEffect` 中，初始化 `accountId`：
```typescript
if (transaction) {
  // ...existing fields...
  setAccountId(transaction.account_id ?? null);
}
```

在 CategoryPicker 和 date selector 之间添加账户选择 UI：
```tsx
{/* Account selector */}
{accounts.length > 0 && (
  <View style={styles.accountSection}>
    <AppText size="md" color={colors.textLighter} style={{ marginBottom: 8 }}>账户（可选）</AppText>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      <TouchableOpacity
        style={[styles.accountChip, accountId === null && styles.accountChipActive]}
        onPress={() => setAccountId(null)}
        activeOpacity={0.7}
      >
        <AppText size="md" weight="medium" color={accountId === null ? colors.white : colors.textLight}>不选择</AppText>
      </TouchableOpacity>
      {accounts.map((a) => (
        <TouchableOpacity
          key={a.id}
          style={[styles.accountChip, accountId === a.id && styles.accountChipActive]}
          onPress={() => setAccountId(a.id)}
          activeOpacity={0.7}
        >
          <AppText style={{ fontSize: 16 }}>{a.icon}</AppText>
          <AppText size="md" weight="medium" color={accountId === a.id ? colors.white : colors.text}>{a.name}</AppText>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
)}
```

在 `handleSubmit` 中的 `createTransaction` 和 `updateTransaction` 调用中添加 `account_id: accountId`：

```typescript
// 新建交易
const txId = await createTransaction({
  amount: numAmount, note, type, occurred_at: date.toISOString(),
  category_id: categoryId, source: "manual", account_id: accountId,
});

// 编辑交易
await updateTransaction({
  id: transaction.id, amount: numAmount, note, type,
  occurred_at: date.toISOString(), category_id: categoryId, account_id: accountId,
});
```

添加新样式：
```typescript
accountSection: {
  marginTop: 20,
},
accountChip: {
  flexDirection: "row", alignItems: "center", gap: 6,
  paddingHorizontal: 14, paddingVertical: 10,
  borderRadius: radii.md, backgroundColor: colors.cream,
},
accountChipActive: {
  backgroundColor: colors.sage,
},
```

- [ ] **Step 3: 提交**

```bash
git add apps/mobile/hooks/useLocalTransactions.ts apps/mobile/app/manual-entry.tsx
git commit -m "feat: add account selection to transaction entry"
```

---

## Task 13: 最终整合验证

**Files:**
- Verify: All new screens accessible from profile page

- [ ] **Step 1: 确认 profile.tsx 导航完整**

确认 `apps/mobile/app/(tabs)/profile.tsx` 中所有菜单项都有 `onPress` 导航：

```typescript
// 资产管理
<MenuItem icon="💳" iconBg={colors.sagePale} title="我的账户" onPress={() => router.push('/accounts')} />
<MenuItem icon="🎯" iconBg={colors.honeyPale} title="预算设置" onPress={() => router.push('/budget-manage')} />
<MenuItem icon="🏷️" iconBg={colors.coralPale} title="分类管理" onPress={() => router.push('/category-manage')} />
```

- [ ] **Step 2: 运行 TypeScript 检查**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: 启动 App 验证**

```bash
cd apps/mobile && npx expo start
```

手动验证清单：
1. "我的"页面显示 profile 头像和昵称
2. 点击头像进入编辑页，可修改昵称和头像（emoji/图片）
3. 分类管理页面显示分类列表，可切换支出/收入 tab
4. 可添加新分类，可编辑分类名称/图标，可删除非预设分类
5. 预算管理页面显示总预算 + 分类预算列表
6. 可添加/编辑/删除分类预算
7. 账户页面显示总资产 + 账户列表
8. 可添加/编辑账户，快捷预设可用
9. 记账页面可选择账户

- [ ] **Step 4: 提交最终整合**

如果有任何修复，统一提交：

```bash
git add -A
git commit -m "fix: integration fixes for profile features"
```

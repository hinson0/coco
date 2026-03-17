# CoCo AI (棉花记) UI 全量改版 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all 7 mobile pages from the current basic green/white theme to the "Soft Organic" design defined in `ui/0316/` mockups.

**Architecture:** Theme-first approach — build a centralized theme system (`theme.ts`), then base UI components, shared composite components, and finally assemble pages. Existing data hooks (`useTransactions`, `useBudgets`, `useChat`, etc.) and API layer remain untouched; only the UI layer is replaced.

**Tech Stack:** React Native (Expo 55), TypeScript, react-native-gifted-charts, react-native-svg, expo-linear-gradient, react-native-reanimated, Zustand, TanStack Query

**Spec:** `docs/superpowers/specs/2026-03-17-ui-redesign-design.md`

**Design mockups:** `ui/0316/*.html` (open in browser for visual reference)

---

## File Structure

```
apps/mobile/
├── constants/
│   └── theme.ts                        ← NEW: colors, spacing, radii, shadows, typography tokens
├── components/
│   ├── ui/                             ← NEW: base primitives
│   │   ├── AppText.tsx                 ← text with theme defaults
│   │   ├── Card.tsx                    ← white rounded card container
│   │   ├── Chip.tsx                    ← rounded tag button (filter/tool)
│   │   ├── IconBox.tsx                 ← emoji in colored square
│   │   └── Badge.tsx                   ← small label (ai/new/pro)
│   ├── shared/                         ← NEW: composite components used across pages
│   │   ├── TransactionItem.tsx         ← single transaction row
│   │   ├── DayGroup.tsx                ← date header + TransactionItem list
│   │   ├── OverviewCard.tsx            ← 6-grid stats + budget bar
│   │   ├── BottomTabBar.tsx            ← custom tab bar with AI center button
│   │   └── MenuItem.tsx                ← settings menu row
│   ├── home/                           ← NEW: home page components
│   │   ├── HeaderGreeting.tsx          ← date + title + avatar
│   │   └── AiBubbleEntry.tsx           ← AI assistant entry bubble
│   ├── chat/                           ← NEW: chat page components
│   │   ├── ChatBubble.tsx              ← message bubble (ai/user variants)
│   │   ├── RecordCard.tsx              ← bill confirmation card
│   │   ├── VoiceBubble.tsx             ← voice message with waveform
│   │   ├── OcrBubble.tsx               ← receipt image bubble
│   │   ├── SuggestionChip.tsx          ← inline suggestion in AI message
│   │   ├── TypingIndicator.tsx         ← three-dot typing animation
│   │   ├── ChatToolBar.tsx             ← horizontal scroll tool chips
│   │   └── ChatInputBar.tsx            ← camera + input + mic + plus
│   ├── bills/                          ← NEW
│   │   ├── FilterBar.tsx               ← category filter chips
│   │   └── MonthStrip.tsx              ← month summary strip
│   ├── stats/                          ← NEW
│   │   ├── PeriodTabs.tsx              ← week/month/year switcher
│   │   ├── MonthSelector.tsx           ← ‹ month ›
│   │   ├── BarChartCard.tsx            ← gifted-charts bar chart
│   │   ├── DonutChartCard.tsx          ← gifted-charts donut chart
│   │   └── TrendInsightRow.tsx         ← AI insight row
│   ├── profile/                        ← NEW
│   │   ├── ProfileHeader.tsx           ← avatar + name + stats
│   │   ├── StatsStrip.tsx              ← 3-column stats bar
│   │   └── AiAssistantCard.tsx         ← AI card
│   └── auth/                           ← NEW
│       ├── AuthInput.tsx               ← themed input
│       └── AuthButton.tsx              ← themed button
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx                 ← REWRITE: new tab structure
│   │   ├── index.tsx                   ← REWRITE: home page
│   │   ├── stats.tsx                   ← REWRITE: statistics page
│   │   ├── bills.tsx                   ← NEW: bills page (replaces budget.tsx)
│   │   └── profile.tsx                 ← REWRITE: profile page
│   ├── chat.tsx                        ← REWRITE: AI chat page
│   └── (auth)/
│       ├── login.tsx                   ← REWRITE
│       └── register.tsx                ← REWRITE
```

---

## Task 1: Install Dependencies + Create Theme

**Files:**
- Modify: `apps/mobile/package.json`
- Create: `apps/mobile/constants/theme.ts`

- [ ] **Step 1: Install new dependencies**

Run from repo root:
```bash
cd apps/mobile && pnpm add react-native-gifted-charts react-native-svg
```

- [ ] **Step 2: Create `theme.ts`**

Create `apps/mobile/constants/theme.ts` with all design tokens from spec Section 2:
- `colors` object: cream, creamDark, creamDeeper, sage, sageLight, sagePale, coral, coralLight, coralPale, honey, honeyLight, honeyPale, lavender, lavenderPale, text, textLight, textLighter, white, shadow
- `spacing` object: mapping named keys to numeric values (xs:4, sm:6, md:8, lg:12, xl:16, xxl:20, xxxl:24)
- `radii` object: sm:8, md:12, lg:18, xl:22, xxl:24, full:9999
- `shadows` object: sm, md, lg, xl — each with `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`, `elevation`
- `typography` object: sizes (xs:9, sm:10, ..., xxxl:26) and weights (regular:'400', medium:'500', semibold:'600', bold:'700', extrabold:'800')
- `categoryColors` mapping: Maps category color names to { bg, icon } pairs using the pale/base color combos (e.g., coral: { bg: coralPale, icon: coral })
- `CATEGORY_COLOR_MAP` constant: Maps common category names to color keys (餐饮→coral, 交通→sage, 购物→honey, 娱乐→lavender, 饮品→honey, 收入→sage). Default fallback: sage. This is used by all pages that render TransactionItem to resolve category → color.

```typescript
export const colors = {
  cream: '#faf6f0',
  creamDark: '#f0e8dc',
  creamDeeper: '#e4d8c8',
  sage: '#7ba68a',
  sageLight: '#a4ccb0',
  sagePale: '#dceee2',
  coral: '#e8856c',
  coralLight: '#f4b0a0',
  coralPale: '#fde8e2',
  honey: '#d4a853',
  honeyLight: '#e8c87a',
  honeyPale: '#fdf4dc',
  lavender: '#9b8ec4',
  lavenderPale: '#ece8f4',
  text: '#3a3028',
  textLight: '#8a7e70',
  textLighter: '#b8aa98',
  white: '#ffffff',
  shadow: 'rgba(58,48,40,0.06)',
} as const;

export const spacing = {
  xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 20, xxxl: 24, xxxxl: 32,
} as const;

export const radii = {
  sm: 8, md: 12, lg: 18, xl: 22, xxl: 24, full: 9999,
} as const;

export const shadows = {
  sm: { shadowColor: '#3a3028', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  md: { shadowColor: '#3a3028', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  lg: { shadowColor: '#3a3028', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 6 },
  xl: { shadowColor: '#3a3028', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 },
} as const;

export const typography = {
  sizes: { xs: 9, sm: 10, base: 11, md: 12, lg: 13, xl: 14, '2xl': 16, '3xl': 18, '4xl': 20, '5xl': 22, '6xl': 26 },
  weights: { regular: '400' as const, medium: '500' as const, semibold: '600' as const, bold: '700' as const, extrabold: '800' as const },
} as const;

export const categoryColors = {
  coral: { bg: '#fde8e2', icon: '#e8856c' },
  sage: { bg: '#dceee2', icon: '#7ba68a' },
  honey: { bg: '#fdf4dc', icon: '#d4a853' },
  lavender: { bg: '#ece8f4', icon: '#9b8ec4' },
} as const;

export type CategoryColorName = keyof typeof categoryColors;

// Maps common category names to color keys. Fallback: 'sage'.
export const CATEGORY_COLOR_MAP: Record<string, CategoryColorName> = {
  '餐饮': 'coral', '交通': 'sage', '购物': 'honey', '娱乐': 'lavender',
  '饮品': 'honey', '生活': 'coral', '医疗': 'coral', '教育': 'lavender',
  '通讯': 'sage', '住房': 'honey', '收入': 'sage', '工资': 'sage',
};

export function getCategoryColor(categoryName: string): CategoryColorName {
  return CATEGORY_COLOR_MAP[categoryName] ?? 'sage';
}
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/constants/theme.ts pnpm-lock.yaml
git commit -m "feat(mobile): add theme system and install chart dependencies"
```

---

## Task 2: Base UI Components

**Files:**
- Create: `apps/mobile/components/ui/AppText.tsx`
- Create: `apps/mobile/components/ui/Card.tsx`
- Create: `apps/mobile/components/ui/Chip.tsx`
- Create: `apps/mobile/components/ui/IconBox.tsx`
- Create: `apps/mobile/components/ui/Badge.tsx`

- [ ] **Step 1: Create `AppText.tsx`**

Thin wrapper around RN `Text`. Props: `size` (keyof typography.sizes, default 'xl' = 14px), `weight` (keyof typography.weights, default 'regular'), `color` (string, default colors.text), `style?`, `children`. Applies font size/weight/color from theme.

```typescript
import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, typography } from '../../constants/theme';

interface AppTextProps extends TextProps {
  readonly size?: keyof typeof typography.sizes;
  readonly weight?: keyof typeof typography.weights;
  readonly color?: string;
}

export function AppText({ size = 'xl', weight = 'regular', color = colors.text, style, children, ...rest }: AppTextProps) {
  const textStyle: TextStyle = {
    fontSize: typography.sizes[size],
    fontWeight: typography.weights[weight],
    color,
  };
  return <Text style={[textStyle, style]} {...rest}>{children}</Text>;
}
```

- [ ] **Step 2: Create `Card.tsx`**

White background, configurable radius (default `lg`=18), shadow (default `md`), padding (default 18). Just a View wrapper.

```typescript
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { colors, radii, shadows } from '../../constants/theme';

interface CardProps extends ViewProps {
  readonly radius?: keyof typeof radii;
  readonly shadow?: keyof typeof shadows;
  readonly padding?: number;
}

export function Card({ radius = 'lg', shadow = 'md', padding = 18, style, children, ...rest }: CardProps) {
  const cardStyle: ViewStyle = {
    backgroundColor: colors.white,
    borderRadius: radii[radius],
    padding,
    ...shadows[shadow],
  };
  return <View style={[cardStyle, style]} {...rest}>{children}</View>;
}
```

- [ ] **Step 3: Create `Chip.tsx`**

Rounded tag button. Props: `label`, `icon?` (emoji string), `active?` (boolean), `onPress`. Active state: sage bg + white text. Inactive: white bg + textLight text + shadow sm.

```typescript
import { TouchableOpacity, type ViewStyle, type TextStyle } from 'react-native';
import { AppText } from './AppText';
import { colors, radii, shadows } from '../../constants/theme';

interface ChipProps {
  readonly label: string;
  readonly icon?: string;
  readonly active?: boolean;
  readonly onPress?: () => void;
}

export function Chip({ label, icon, active = false, onPress }: ChipProps) {
  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: radii.full,
    backgroundColor: active ? colors.sage : colors.white,
    ...(active ? {} : shadows.sm),
  };
  const textColor = active ? colors.white : colors.textLight;

  return (
    <TouchableOpacity style={containerStyle} onPress={onPress} activeOpacity={0.7}>
      {icon ? <AppText size="xl" color={textColor}>{icon}</AppText> : null}
      <AppText size="md" weight="semibold" color={textColor}>{label}</AppText>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 4: Create `IconBox.tsx`**

Emoji in a colored square. Props: `emoji`, `colorName` (coral/sage/honey/lavender). 40x40, radius md(12).

```typescript
import { View, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { categoryColors, radii } from '../../constants/theme';

interface IconBoxProps {
  readonly emoji: string;
  readonly colorName: keyof typeof categoryColors;
}

export function IconBox({ emoji, colorName }: IconBoxProps) {
  const style: ViewStyle = {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: categoryColors[colorName].bg,
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <View style={style}>
      <AppText size="3xl">{emoji}</AppText>
    </View>
  );
}
```

- [ ] **Step 5: Create `Badge.tsx`**

Small label. Props: `text`, `variant` (ai/new/pro). ai: sage bg + white. new: coralPale bg + coral. pro: honeyPale bg + honey.

```typescript
import { View, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { colors } from '../../constants/theme';

type BadgeVariant = 'ai' | 'new' | 'pro';

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  ai: { bg: colors.sage, text: colors.white },
  new: { bg: colors.coralPale, text: colors.coral },
  pro: { bg: colors.honeyPale, text: colors.honey },
};

interface BadgeProps {
  readonly text: string;
  readonly variant: BadgeVariant;
}

export function Badge({ text, variant }: BadgeProps) {
  const v = variantStyles[variant];
  const style: ViewStyle = {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: v.bg,
  };
  return (
    <View style={style}>
      <AppText size="xs" weight="bold" color={v.text}>{text}</AppText>
    </View>
  );
}
```

- [ ] **Step 6: Verify TypeScript compilation**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/ui/
git commit -m "feat(mobile): add base UI components (AppText, Card, Chip, IconBox, Badge)"
```

---

## Task 3: Shared Components — TransactionItem + DayGroup

**Files:**
- Create: `apps/mobile/components/shared/TransactionItem.tsx`
- Create: `apps/mobile/components/shared/DayGroup.tsx`

- [ ] **Step 1: Create `TransactionItem.tsx`**

Displays a single transaction row. Uses IconBox + AppText + Badge.

Props: `transaction: Transaction` (from `@coco/shared`), `categoryIcon: string`, `categoryName: string`, `categoryColor: keyof typeof categoryColors`, `onPress?: () => void`.

Layout: horizontal flex — IconBox | info column (name 13px semibold + meta row: time · category + optional AI badge) | amount 14px bold (text color for expense, sage for income).

Container: white bg, radius lg(18), padding 12x14, shadow sm, press effect translateX(3px).

Reference: spec Section 4.2 TransactionItem, `ui/0316/design-c-soft-organic.html` lines 356-423.

```typescript
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { IconBox } from '../ui/IconBox';
import { Badge } from '../ui/Badge';
import { colors, radii, shadows, type CategoryColorName } from '../../constants/theme';
import type { Transaction } from '@coco/shared';

interface TransactionItemProps {
  readonly transaction: Transaction;
  readonly categoryIcon: string;
  readonly categoryName: string;
  readonly categoryColor: CategoryColorName;
  readonly onPress?: () => void;
}

export function TransactionItem({ transaction, categoryIcon, categoryName, categoryColor, onPress }: TransactionItemProps) {
  const isIncome = transaction.type === 'income';
  const amountPrefix = isIncome ? '+' : '-';
  const amountColor = isIncome ? colors.sage : colors.text;
  const time = new Date(transaction.occurred_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const isAi = transaction.source === 'text' || transaction.source === 'asr' || transaction.source === 'ocr';

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <IconBox emoji={categoryIcon} colorName={categoryColor} />
      <View style={styles.info}>
        <AppText size="lg" weight="semibold">{transaction.note || categoryName}</AppText>
        <View style={styles.meta}>
          <AppText size="base" color={colors.textLighter}>{time} · {categoryName}</AppText>
          {isAi ? <Badge text="AI" variant="ai" /> : null}
        </View>
      </View>
      <AppText size="xl" weight="bold" color={amountColor}>
        {amountPrefix}¥{Math.abs(transaction.amount).toLocaleString()}
      </AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    marginBottom: 8,
    ...shadows.md,
  },
  info: { flex: 1, minWidth: 0 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
});
```

- [ ] **Step 2: Create `DayGroup.tsx`**

Date header + list of TransactionItems.

Props: `label: string` (e.g., "今天"), `date: string` (e.g., "3月16日 周一"), `total: string` (e.g., "-¥39"), `totalColor?: string`, `children: ReactNode` (TransactionItem list).

```typescript
import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';

interface DayGroupProps {
  readonly label: string;
  readonly date: string;
  readonly total: string;
  readonly totalColor?: string;
  readonly children: ReactNode;
}

export function DayGroup({ label, date, total, totalColor = colors.coral, children }: DayGroupProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <AppText size="lg" weight="bold">{label}</AppText>
          <AppText size="base" color={colors.textLighter}>{date}</AppText>
        </View>
        <AppText size="md" weight="semibold" color={totalColor}>{total}</AppText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
});
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/shared/TransactionItem.tsx apps/mobile/components/shared/DayGroup.tsx
git commit -m "feat(mobile): add TransactionItem and DayGroup shared components"
```

---

## Task 4: Shared Components — OverviewCard + MenuItem

**Files:**
- Create: `apps/mobile/components/shared/OverviewCard.tsx`
- Create: `apps/mobile/components/shared/MenuItem.tsx`

- [ ] **Step 1: Create `OverviewCard.tsx`**

6-grid financial overview with budget progress bar. Reference: spec Section 5.1, `ui/0316/design-c-soft-organic.html` lines 580-622.

Props: `expense`, `income`, `balance`, `budget`, `remaining`, `dailyAvg`, `budgetPercent`, `daysLeft`, `subs?` (optional sub-labels object).

```typescript
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';
import { useEffect } from 'react';
import { AppText } from '../ui/AppText';
import { Card } from '../ui/Card';
import { colors } from '../../constants/theme';

interface OverviewSubs {
  readonly expense?: string; readonly income?: string; readonly balance?: string;
  readonly budget?: string; readonly remaining?: string; readonly dailyAvg?: string;
}

interface OverviewCardProps {
  readonly expense: string; readonly income: string; readonly balance: string;
  readonly budget: string; readonly remaining: string; readonly dailyAvg: string;
  readonly budgetPercent: number; readonly daysLeft: number;
  readonly subs?: OverviewSubs;
}

function Cell({ label, value, valueColor, sub }: { label: string; value: string; valueColor: string; sub?: string }) {
  return (
    <View style={styles.cell}>
      <AppText size="sm" weight="medium" color={colors.textLighter}>{label}</AppText>
      <AppText size="2xl" weight="bold" color={valueColor}>{value}</AppText>
      {sub ? <AppText size="xs" color={colors.textLighter}>{sub}</AppText> : null}
    </View>
  );
}

export function OverviewCard({ expense, income, balance, budget, remaining, dailyAvg, budgetPercent, daysLeft, subs }: OverviewCardProps) {
  const barWidth = useSharedValue(0);
  useEffect(() => { barWidth.value = withTiming(budgetPercent, { duration: 1000 }); }, [budgetPercent]);
  const barStyle = useAnimatedStyle(() => ({ width: `${barWidth.value}%` }));

  return (
    <Card radius="xl" shadow="lg" padding={18}>
      <View style={styles.grid}>
        <Cell label="支出" value={expense} valueColor={colors.coral} sub={subs?.expense} />
        <Cell label="收入" value={income} valueColor={colors.sage} sub={subs?.income} />
        <Cell label="结余" value={balance} valueColor={colors.text} sub={subs?.balance} />
      </View>
      <View style={styles.divider} />
      <View style={styles.grid}>
        <Cell label="本月预算" value={budget} valueColor={colors.honey} sub={subs?.budget} />
        <Cell label="月剩余" value={remaining} valueColor={colors.sage} sub={subs?.remaining} />
        <Cell label="剩余日均" value={dailyAvg} valueColor={colors.lavender} sub={`还剩${daysLeft}天`} />
      </View>
      <View style={styles.barContainer}>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFillWrapper, barStyle]}>
            <LinearGradient colors={['#e8c87a', '#f4b0a0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.barFill} />
          </Animated.View>
        </View>
        <View style={styles.barLabels}>
          <AppText size="xs" color={colors.textLighter}>已用 {budgetPercent}%</AppText>
          <AppText size="xs" color={colors.textLighter}>{expense} / {budget}</AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  divider: { height: 1, backgroundColor: colors.creamDark, marginHorizontal: 10, marginVertical: 2 },
  barContainer: { paddingTop: 4, paddingHorizontal: 6 },
  barTrack: { height: 6, backgroundColor: colors.creamDark, borderRadius: 6, overflow: 'hidden' },
  barFillWrapper: { height: '100%' },
  barFill: { flex: 1, borderRadius: 6 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
});
```

- [ ] **Step 2: Create `MenuItem.tsx`**

Settings menu row with icon, title, description, optional badge, and arrow.

Note: MenuItem uses a simple View for the icon container (not IconBox) because it needs arbitrary `iconBg` colors, not just the 4 category colors.

```typescript
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { Badge, type BadgeVariant } from '../ui/Badge';
import { colors, radii } from '../../constants/theme';

interface MenuItemProps {
  readonly icon: string;
  readonly iconBg: string;
  readonly title: string;
  readonly desc?: string;
  readonly badge?: { text: string; variant: BadgeVariant };
  readonly onPress?: () => void;
}

export function MenuItem({ icon, iconBg, title, desc, badge, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        <AppText size="3xl">{icon}</AppText>
      </View>
      <View style={styles.info}>
        <AppText size="xl" weight="medium">{title}</AppText>
        {desc ? <AppText size="base" color={colors.textLighter} style={{ marginTop: 1 }}>{desc}</AppText> : null}
      </View>
      {badge ? <Badge text={badge.text} variant={badge.variant} /> : null}
      <AppText size="xl" color={colors.textLighter}>›</AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
});
```

Note: `BadgeVariant` type must be exported from `Badge.tsx` — add `export` to the type declaration in Task 2 Step 5.

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/shared/OverviewCard.tsx apps/mobile/components/shared/MenuItem.tsx
git commit -m "feat(mobile): add OverviewCard and MenuItem shared components"
```

---

## Task 5: BottomTabBar + Tab Layout Rewrite

**Files:**
- Create: `apps/mobile/components/shared/BottomTabBar.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Create `BottomTabBar.tsx`**

Custom tab bar component. Reference: spec Section 3, `ui/0316/design-c-soft-organic.html` lines 428-486.

Uses Expo Router's `BottomTabBarProps`. Renders 5 items: 🏡首页, 📊统计, AI center button, 📋账单, 🌿我的.

AI center button: 56x56, borderRadius 18, `expo-linear-gradient` LinearGradient (colors: ['#5a9468', '#7ba68a', '#8fc4a0']), marginTop -18, shadow, contains "AI" text + ✦ star (use `react-native-svg` Svg+Text+Path for the star).

Non-active items: opacity 0.35. Active items: opacity 1. Labels: 10px semibold.

AI button `onPress` → `router.push('/chat')`. AI button press animation: `transform: scale(0.92)` on press via `Pressable` + reanimated `useAnimatedStyle`.

- [ ] **Step 2: Rewrite `_layout.tsx`**

Replace existing tab layout. New structure:
- 5 Tabs: index (首页), stats (统计), ai-placeholder (hidden, button handled by BottomTabBar), bills (new), profile (我的)
- Use `tabBar` prop to render custom `BottomTabBar`
- `headerShown: false` for all screens
- Background color: cream

Remove references to old `budget` tab. AI center button is handled in BottomTabBar, not as a real tab screen.

- [ ] **Step 3: Create empty `bills.tsx` placeholder**

Create `apps/mobile/app/(tabs)/bills.tsx` with minimal content (just a View with cream background and "账单" text) so the tab bar doesn't break. Full implementation in Task 8.

- [ ] **Step 4: Delete old files**

```bash
rm apps/mobile/app/(tabs)/budget.tsx apps/mobile/app/(tabs)/ai-placeholder.tsx
```

- [ ] **Step 5: Verify app starts**

```bash
cd apps/mobile && npx expo start --ios
```

Verify: app launches, 5 tabs visible, AI center button appears with gradient, tapping AI button navigates to chat, all tabs render without crash.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/shared/BottomTabBar.tsx apps/mobile/app/\(tabs\)/
git commit -m "feat(mobile): rewrite tab layout with custom BottomTabBar and AI center button"
```

---

## Task 6: Home Page

**Files:**
- Create: `apps/mobile/components/home/HeaderGreeting.tsx`
- Create: `apps/mobile/components/home/AiBubbleEntry.tsx`
- Modify: `apps/mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Create `HeaderGreeting.tsx`**

Reference: spec Section 5.1 item 2, `ui/0316/design-c-soft-organic.html` lines 89-126.

Top section with Chinese date ("三月十六日 周一 ☀️") + "棉花记" title + 🌿 avatar.

Use `Date` to generate Chinese date string. Avatar: 44x44, radius 16, LinearGradient (sagePale → coralPale), 🌿 emoji center.

- [ ] **Step 2: Create `AiBubbleEntry.tsx`**

Reference: spec Section 5.1 item 3, `ui/0316/design-c-soft-organic.html` lines 128-208.

Touchable container → navigates to `/chat`. LinearGradient (sagePale → #edf6f0), radius 24.

Contents: AI avatar (34x34, sage bg, 🤖, gentle-bounce animation via `react-native-reanimated` `useAnimatedStyle` + `withRepeat` + `withSequence` + `withTiming`), "棉花助手" title + "随时帮你记一笔~" subtitle, fake input area (rgba(255,255,255,0.7) bg, radius 16, typing dots animation + "说说你花了什么..." text).

Typing dots: 3 small circles (5px, sage bg), staggered opacity+translateY animation using reanimated.

- [ ] **Step 3: Rewrite `index.tsx`**

Replace current home screen. Structure:
- StatusBar background: cream
- ScrollView with cream bg, padding
- HeaderGreeting
- AiBubbleEntry
- OverviewCard — wire to `useBudgets()` + `useTransactions()` data (compute stats from transaction list)
- DayGroup list — group transactions by date, render with TransactionItem

Import and use existing `useTransactions` and `useBudgets` hooks. The data shape from these hooks provides everything needed.

**Page entry animation**: Each major section (HeaderGreeting, AiBubbleEntry, OverviewCard, tx list) should enter with `floatIn` — opacity 0→1 + translateY 20→0, staggered by 0.1s using reanimated `FadeInDown.delay(N)`.

**Data note**: `useTransactions(page)` returns paginated data (20 per page). For the home page, page 1 is sufficient — we only show recent transactions. For actual stats (expense total, income total, balance), use the existing `/api/stats` endpoint if available, or compute from the first page as an approximation. The OverviewCard will display approximate values from available data. Full accuracy can be improved later with a dedicated stats hook.

- [ ] **Step 4: Verify in simulator**

Check: cream background, greeting shows date, AI bubble animates, overview card shows data, transaction list grouped by day.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/home/ apps/mobile/app/\(tabs\)/index.tsx
git commit -m "feat(mobile): rewrite home page with soft organic design"
```

---

## Task 7: Bills Page

**Files:**
- Create: `apps/mobile/components/bills/FilterBar.tsx`
- Create: `apps/mobile/components/bills/MonthStrip.tsx`
- Modify: `apps/mobile/app/(tabs)/bills.tsx`

- [ ] **Step 1: Create `FilterBar.tsx`**

Horizontal scroll list of Chip components. Props: `categories`, `activeId`, `onSelect`. Reference: `ui/0316/page-bills.html` lines 87-112.

Uses ScrollView horizontal + Chip components. First item is always "全部" (id=null).

- [ ] **Step 2: Create `MonthStrip.tsx`**

White card showing month label + transaction count badge + total amount. Reference: `ui/0316/page-bills.html` lines 114-151.

Props: `month: string`, `count: number`, `total: string`.

- [ ] **Step 3: Rewrite `bills.tsx`**

Full bills page: Header ("账单" 22px + 🔍 search button) → FilterBar → MonthStrip → DayGroup list.

Wire to `useTransactions()` hook. Filter state managed locally with `useState`.

Reuse DayGroup + TransactionItem from shared components.

**Pagination**: Use `useTransactions(page)` with local `page` state. Add a "加载更多" button or `onEndReached` on FlatList to increment page and append results. The `PaginatedResponse` type includes `total` and `page` fields to know when to stop.

**Category resolution**: Use `useCategories()` hook to get category list, create a lookup map by id, then use `getCategoryColor(category.name)` from theme.ts to resolve the color for each TransactionItem.

- [ ] **Step 4: Verify in simulator**

Check: filter chips scroll, active chip is sage, month strip shows, transactions grouped by day.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/bills/ apps/mobile/app/\(tabs\)/bills.tsx
git commit -m "feat(mobile): add bills page with category filters"
```

---

## Task 8: Chat Components

**Files:**
- Create: `apps/mobile/components/chat/ChatBubble.tsx`
- Create: `apps/mobile/components/chat/RecordCard.tsx`
- Create: `apps/mobile/components/chat/VoiceBubble.tsx`
- Create: `apps/mobile/components/chat/OcrBubble.tsx`
- Create: `apps/mobile/components/chat/SuggestionChip.tsx`
- Create: `apps/mobile/components/chat/TypingIndicator.tsx`
- Create: `apps/mobile/components/chat/ChatToolBar.tsx`
- Create: `apps/mobile/components/chat/ChatInputBar.tsx`

- [ ] **Step 1: Create `SuggestionChip.tsx`**

Simple component. sagePale bg, radius 20, sage text 12px. onPress callback. Pressed state: sage bg + white text (use `Pressable` with style function).

- [ ] **Step 2: Create `RecordCard.tsx`**

Bill confirmation card embedded in AI bubble. Reference: spec Section 4.2, `ui/0316/page-ai-chat.html` lines 205-296.

Props: `transaction`, `status: 'pending' | 'done'`, `onConfirm?`, `onEdit?`, `variant?: 'text' | 'ocr'`.

Layout: cream bg, radius 14, border 1px creamDark.
- Header: emoji + "记账确认" title + status badge (sagePale bg + "已记录" if done)
- Rows: key-value pairs with creamDark bottom border
- Amount row value in coral, 15px bold
- variant='ocr' → shows 商户 + 明细 rows
- variant='text' (default) → shows 金额 + 分类 + 备注
- Footer (if status='pending'): "确认记录" (sage bg, flex:1) + "修改" (creamDark bg) buttons

- [ ] **Step 3: Create `VoiceBubble.tsx`**

Voice message with waveform. Reference: `ui/0316/page-ai-chat.html` lines 351-455.

Props: `role: 'user' | 'assistant'` (matches `ChatMessage.role` type), `duration: number`, `isPlaying: boolean`, `onPlay: () => void`, `transcription?: string`.

User (role='user'): sage bg, right-top small radius. AI (role='assistant'): white bg, left-top small radius.
3 bars with different heights. Playing animation: bars oscillate using reanimated.
Below bubble: optional transcription text.

- [ ] **Step 4: Create `OcrBubble.tsx`**

Receipt image bubble. User-side message (right-aligned). Reference: `ui/0316/page-ai-chat.html` lines 456-514.

Props: `imageUri?: string`. Fixed width 160. Top: receipt placeholder (cream gradient bg + 🧾 emoji + lines + bold amount). Bottom: sage bg "📸 小票识别" label.

- [ ] **Step 5: Create `TypingIndicator.tsx`**

AI avatar (28x28 sage bg 🤖) + white bubble with 3 sage dots. Dots animate opacity + translateY staggered. Reference: `ui/0316/page-ai-chat.html` lines 322-349.

- [ ] **Step 6: Create `ChatBubble.tsx`**

Master bubble component. Routes to correct sub-component based on `message.content_type` and `message.role`.

Props: `message: ChatMessage`, `transaction?: Transaction` (for bill_card type).

Rendering logic:
- role=user, content_type=text → user text bubble (sage bg, white text, right-top 6px radius)
- role=user, content_type=audio → VoiceBubble (user variant)
- role=user, content_type=image → OcrBubble
- role=assistant, content_type=text → AI text bubble (white bg, left-top 6px radius) with avatar
- role=assistant, content_type=bill_card → AI bubble wrapping RecordCard
- role=assistant, content_type=nl_result → AI text bubble (same as text)

Each AI bubble has: msg-header (avatar 28x28 sage + "棉花助手" label) → bubble body → time stamp.

- [ ] **Step 7: Create `ChatToolBar.tsx`**

Horizontal scroll of tool chips. Reference: `ui/0316/page-ai-chat.html` lines 555-591.

Items: ⚡快速记账, 📸拍小票, 📊月度报告, 📋记账模板, 🔄重复记.

Each item: cream bg, creamDark border, radius 20, 12px text. ScrollView horizontal.

Props: `onSelectTool: (tool: string) => void`.

- [ ] **Step 8: Create `ChatInputBar.tsx`**

Bottom input bar. Reference: `ui/0316/page-ai-chat.html` lines 592-654.

Props: `onSendText`, `onCamera`, `onVoice`, `onPlus`.

Layout: [📷 button] + TextInput (cream bg, creamDeeper border, radius 22, placeholder "记一笔或按住说话...") + [🎤 button (cream bg, creamDeeper border, round)] + [+ button (sage bg, white text, round, shadow)].

- [ ] **Step 9: Verify TypeScript**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/components/chat/
git commit -m "feat(mobile): add chat UI components (bubble, record card, voice, OCR, toolbar, input)"
```

---

## Task 9: AI Chat Page

**Files:**
- Modify: `apps/mobile/app/chat.tsx`

- [ ] **Step 1: Rewrite `chat.tsx`**

Full chat page assembly. Reference: spec Section 5.2, `ui/0316/page-ai-chat.html`.

Structure:
1. Top bar: View with [←] back button (white 36x36 radius 12) + 🟢 dot (6px sage, pulse animation) + "棉花助手" title + [···] action button
2. Chat area: FlatList `inverted` rendering ChatBubble for each message from `useChatStore().messages`
3. Bottom panel (white bg, creamDark top border):
   - ChatToolBar
   - ChatInputBar

Wire to existing `useChat()` hook for sendText/sendOcr/sendAsr.
Wire to `useChatStore()` for messages and isLoading state.
Show TypingIndicator when `isLoading` is true.

Add welcome message on mount if messages array is empty.

**Date separators**: Insert a date divider (centered, 11px, textLighter, e.g., "今天 3月16日") between messages that belong to different calendar days. Compute by comparing `created_at` of adjacent messages.

**Message entry animation**: Each ChatBubble should enter with `msgIn` animation — opacity 0→1 + translateY 10→0, 0.4s — using reanimated `FadeInDown`.

**RecordCard variant mapping**: When ChatBubble renders a `bill_card` message, parse the transaction from `message.content` (JSON), check `transaction.source`: if `'ocr'` → pass `variant='ocr'`, else `variant='text'`.

- [ ] **Step 2: Verify in simulator**

Check: navigation from AI button, messages render, text input works, typing indicator shows during API call, record cards display.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/chat.tsx
git commit -m "feat(mobile): rewrite AI chat page with new design"
```

---

## Task 10: Statistics Page

**Files:**
- Create: `apps/mobile/components/stats/PeriodTabs.tsx`
- Create: `apps/mobile/components/stats/MonthSelector.tsx`
- Create: `apps/mobile/components/stats/BarChartCard.tsx`
- Create: `apps/mobile/components/stats/DonutChartCard.tsx`
- Create: `apps/mobile/components/stats/TrendInsightRow.tsx`
- Modify: `apps/mobile/app/(tabs)/stats.tsx`

- [ ] **Step 1: Create `PeriodTabs.tsx`**

Week/Month/Year pill switcher. White bg, radius 12, shadow md. Active tab: sage bg + white text. Reference: `ui/0316/page-statistics.html` lines 82-104.

Props: `active: 'week' | 'month' | 'year'`, `onChange`.

- [ ] **Step 2: Create `MonthSelector.tsx`**

‹ / current month / › horizontal selector. Arrow buttons: white 28x28 radius 8.

Props: `year`, `month`, `onPrev`, `onNext`.

- [ ] **Step 3: Create `BarChartCard.tsx`**

Wraps `react-native-gifted-charts` `BarChart`. Reference: spec Section 5.4, `ui/0316/page-statistics.html` lines 169-263.

Props: `data: Array<{ label: string; expense: number; income: number }>`.

Card wrapper with "每周对比" title + legend. BarChart config:
- `barBorderRadius: 4`
- `isAnimated: true`
- Two bars per group: coralLight for expense, sageLight for income
- Grid lines via `showReferenceLine1`
- `xAxisLabelTextStyle`: 9px textLighter

Consult `react-native-gifted-charts` docs for exact prop names.

- [ ] **Step 4: Create `DonutChartCard.tsx`**

Wraps `react-native-gifted-charts` `PieChart` in donut mode. Reference: `ui/0316/page-statistics.html` lines 265-563.

Props: `data: Array<{ emoji: string; name: string; amount: number; percent: number; color: string }>`, `total: string`.

Layout: Card with "支出分类" title → horizontal flex: PieChart (donut, radius 55, innerRadius 35, centerLabel total) | category list.

- [ ] **Step 5: Create `TrendInsightRow.tsx`**

AI insight row. Reference: `ui/0316/page-statistics.html` lines 345-399.

Props: `emoji`, `title`, `desc`, `badge?: { text: string; direction: 'up' | 'down' }`.

Badge: up → coralPale bg + coral text. down → sagePale bg + sage text.

Rows separated by 1px creamDark border.

- [ ] **Step 6: Rewrite `stats.tsx`**

Full statistics page. Header ("统计" + PeriodTabs) → MonthSelector → 3 summary cards (Card + stats) → BarChartCard → DonutChartCard → TrendInsightRow list in a Card.

Wire to `useTransactions()` for data. Compute weekly aggregates and category breakdowns client-side.

- [ ] **Step 7: Verify in simulator**

Check: period tabs switch, month navigation works, bar chart renders with animation, donut chart shows categories, AI insights display.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/components/stats/ apps/mobile/app/\(tabs\)/stats.tsx
git commit -m "feat(mobile): rewrite statistics page with charts and AI insights"
```

---

## Task 11: Profile Page

**Files:**
- Create: `apps/mobile/components/profile/ProfileHeader.tsx`
- Create: `apps/mobile/components/profile/StatsStrip.tsx`
- Create: `apps/mobile/components/profile/AiAssistantCard.tsx`
- Modify: `apps/mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Create `ProfileHeader.tsx`**

Reference: spec Section 5.5, `ui/0316/page-profile.html` lines 66-112.

Centered layout: settings button top-right (⚙️, white 36x36 radius 12) + avatar (🌿, 72x72, radius 24, LinearGradient sagePale→coralPale) + name (20px bold) + "已记账 X 天" (12px textLighter).

- [ ] **Step 2: Create `StatsStrip.tsx`**

3-column stats in white card. Reference: `ui/0316/page-profile.html` lines 114-151.

Props: `items: Array<{ value: string; label: string }>`. Vertical dividers between columns.

- [ ] **Step 3: Create `AiAssistantCard.tsx`**

Sage-pale gradient card. Reference: `ui/0316/page-profile.html` lines 232-282.

🤖 avatar (44x44, sage bg, radius 14, shadow) + "棉花助手" title (sage bold) + description + › arrow. Touchable → navigates to /chat.

- [ ] **Step 4: Rewrite `profile.tsx`**

Full profile page. ScrollView: ProfileHeader → StatsStrip → AiAssistantCard → 3 MenuSections (资产管理, 工具, 其他) using Card + MenuItem.

Wire to `useTransactions()` for stats data.

- [ ] **Step 5: Verify in simulator**

Check: avatar displays, stats strip shows data, AI card navigates to chat, all menu items render with correct icons/badges.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/profile/ apps/mobile/app/\(tabs\)/profile.tsx
git commit -m "feat(mobile): rewrite profile page with menu sections"
```

---

## Task 12: Auth Pages

**Files:**
- Create: `apps/mobile/components/auth/AuthInput.tsx`
- Create: `apps/mobile/components/auth/AuthButton.tsx`
- Modify: `apps/mobile/app/(auth)/login.tsx`
- Modify: `apps/mobile/app/(auth)/register.tsx`

- [ ] **Step 1: Create `AuthInput.tsx`**

Themed input. Props: `placeholder`, `value`, `onChangeText`, `secureTextEntry?`.

Cream bg, creamDeeper border, radius 12. Focus state: sageLight border. Height 48, padding horizontal 16, font 14px.

- [ ] **Step 2: Create `AuthButton.tsx`**

Themed button. Props: `title`, `onPress`, `loading?`.

Sage bg, white text, radius 12, height 48, shadow md. Loading state: ActivityIndicator.

- [ ] **Step 3: Rewrite `login.tsx`**

Full-screen cream bg. Centered: 🌿 logo (72px) + "棉花记" (26px bold) + "AI 智能记账助手" (13px textLighter) + white Card with AuthInput (email) + AuthInput (password) + AuthButton ("登录") + "还没有账号？去注册" link (sage text).

Wire to existing `useAuth()` hook.

- [ ] **Step 4: Rewrite `register.tsx`**

Same layout as login but with additional "确认密码" field and "注册" button text. Link: "已有账号？去登录".

- [ ] **Step 5: Verify in simulator**

Check: login/register pages show with cream bg, inputs focus animation works, buttons trigger auth.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/auth/ apps/mobile/app/\(auth\)/
git commit -m "feat(mobile): rewrite auth pages with soft organic style"
```

---

## Task 13: Cleanup Old Files

**Files:**
- Delete: 14 files per spec Section 7.1

- [ ] **Step 1: Delete deprecated files**

```bash
cd apps/mobile
rm constants/Colors.ts
rm components/home/DailySummary.tsx components/home/TransactionList.tsx
rm components/chat/BillCard.tsx components/chat/ChatInput.tsx components/chat/ChatMessage.tsx components/chat/VoiceRecorder.tsx
rm components/EditScreenInfo.tsx components/StyledText.tsx components/Themed.tsx
rm components/useClientOnlyValue.ts components/useClientOnlyValue.web.ts
rm components/useColorScheme.ts components/useColorScheme.web.ts
```

- [ ] **Step 2: Search for remaining references to deleted files**

```bash
grep -r "Colors" apps/mobile/--include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v theme.ts
grep -r "DailySummary\|TransactionList\|BillCard\|ChatInput\|ChatMessage\|VoiceRecorder\|EditScreenInfo\|StyledText\|Themed\|useClientOnlyValue\|useColorScheme" apps/mobile/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Fix any remaining imports that reference deleted files.

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 4: Verify app runs**

```bash
cd apps/mobile && npx expo start --ios
```

Navigate through all tabs and chat page. Confirm no crashes.

- [ ] **Step 5: Commit**

```bash
git add -A apps/mobile/
git commit -m "chore(mobile): remove deprecated UI files replaced by new design system"
```

---

## Summary

| Task | Component | Files | Depends On |
|------|-----------|-------|------------|
| 1 | Theme + Dependencies | 2 | — |
| 2 | Base UI Components | 5 | Task 1 |
| 3 | TransactionItem + DayGroup | 2 | Task 2 |
| 4 | OverviewCard + MenuItem | 2 | Task 2 |
| 5 | BottomTabBar + Layout | 3 | Task 2 |
| 6 | Home Page | 3 | Tasks 3, 4, 5 |
| 7 | Bills Page | 3 | Tasks 3, 5 |
| 8 | Chat Components | 8 | Task 2 |
| 9 | Chat Page | 1 | Task 8 |
| 10 | Statistics Page | 6 | Task 2 |
| 11 | Profile Page | 4 | Tasks 4, 5 |
| 12 | Auth Pages | 4 | Task 2 |
| 13 | Cleanup | 0 (deletions) | All above |

**Parallelizable:** Tasks 3, 4, 5 can run in parallel after Task 2. Tasks 6, 7, 8, 10, 11, 12 can run in parallel after their dependencies.

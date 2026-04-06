# 聊天记账 Bug 修复 + 大宗消费标签 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复关键词匹配误命中数字和卡片溢出两个 bug，新增大宗消费标签功能

**Architecture:** 三个独立改动：(1) 规则引擎两阶段匹配 + 数字剥离工具函数 (2) 卡片加宽 + 统一金额格式化 + 弹性缩放兜底 (3) 大宗消费 Badge 标签（复用现有 `pro` 变体）

**Tech Stack:** React Native (Expo 55), TypeScript, Jest + ts-jest

**Spec:** `docs/superpowers/specs/2026-03-23-chat-bugfix-major-tag-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/mobile/lib/rule-engine/strip-amount.ts` | Create | 共用数字剥离函数 |
| `apps/mobile/lib/rule-engine/strip-amount.test.ts` | Create | stripAmount 测试 |
| `apps/mobile/lib/rule-engine/match-category.ts` | Modify | 两阶段匹配 |
| `apps/mobile/lib/rule-engine/match-category.test.ts` | Create | matchCategory 测试 |
| `apps/mobile/lib/rule-engine/keywords.ts` | Modify | 补充关键词 + 去重 |
| `apps/mobile/lib/rule-engine/index.ts` | Modify | isIncome 使用 stripAmount |
| `apps/mobile/lib/rule-engine/index.test.ts` | Create | parse() 集成测试 |
| `apps/mobile/lib/format.ts` | Create | formatAmount 工具函数 |
| `apps/mobile/lib/format.test.ts` | Create | formatAmount 测试 |
| `packages/shared/src/constants/transaction.ts` | Create | MAJOR_AMOUNT_THRESHOLD |
| `packages/shared/src/index.ts` | Modify | 导出新常量 |
| `apps/mobile/components/chat/ChatBubble.tsx` | Modify | rowCard maxWidth → 100% |
| `apps/mobile/components/chat/RecordCard.tsx` | Modify | 统一格式化 + adjustsFontSizeToFit + Badge |
| `apps/mobile/components/shared/TransactionItem.tsx` | Modify | 统一格式化 + Badge |

---

### Task 1: 创建 stripAmount 工具函数

**Files:**
- Create: `apps/mobile/lib/rule-engine/strip-amount.ts`
- Create: `apps/mobile/lib/rule-engine/strip-amount.test.ts`

- [ ] **Step 1: 写 stripAmount 测试**

```typescript
// apps/mobile/lib/rule-engine/strip-amount.test.ts
import { stripAmount } from "./strip-amount";

describe("stripAmount", () => {
  it("strips plain numbers", () => {
    expect(stripAmount("买车100000")).toBe("买车");
  });

  it("strips yen-prefixed amounts", () => {
    expect(stripAmount("咖啡¥25")).toBe("咖啡");
    expect(stripAmount("咖啡￥25")).toBe("咖啡");
  });

  it("strips decimal amounts", () => {
    expect(stripAmount("买车99999.99")).toBe("买车");
  });

  it("strips amounts with 元/块 suffix", () => {
    expect(stripAmount("午饭35元")).toBe("午饭");
    expect(stripAmount("打车20块")).toBe("打车");
  });

  it("returns empty string for pure number input", () => {
    expect(stripAmount("10086")).toBe("");
  });

  it("preserves non-numeric text", () => {
    expect(stripAmount("星巴克咖啡")).toBe("星巴克咖啡");
  });

  it("handles mixed text and multiple numbers", () => {
    expect(stripAmount("买了2杯咖啡50")).toBe("买了杯咖啡");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd apps/mobile && npx jest lib/rule-engine/strip-amount.test.ts`
Expected: FAIL — Cannot find module './strip-amount'

- [ ] **Step 3: 实现 stripAmount**

```typescript
// apps/mobile/lib/rule-engine/strip-amount.ts

/**
 * 从文本中剥离金额数字部分，返回纯文字。
 * 处理格式：¥100、￥100、100元、100块、100.50、纯数字
 */
export function stripAmount(text: string): string {
  return text.replace(/[¥￥]?\d+\.?\d{0,2}\s*(元|块)?/g, "").trim();
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd apps/mobile && npx jest lib/rule-engine/strip-amount.test.ts`
Expected: PASS — 7 tests passed

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/lib/rule-engine/strip-amount.ts apps/mobile/lib/rule-engine/strip-amount.test.ts
git commit -m "feat: add stripAmount utility for rule engine"
```

---

### Task 2: 修复 matchCategory 两阶段匹配

**Files:**
- Modify: `apps/mobile/lib/rule-engine/match-category.ts`
- Create: `apps/mobile/lib/rule-engine/match-category.test.ts`

- [ ] **Step 1: 写 matchCategory 测试**

```typescript
// apps/mobile/lib/rule-engine/match-category.test.ts
import { matchCategory } from "./match-category";

describe("matchCategory", () => {
  // Bug fix: 数字子串不应误匹配
  it('does not match "10000" inside "买车100000"', () => {
    expect(matchCategory("买车100000")).not.toBe("通讯");
  });

  it('matches "买车100000" to 交通', () => {
    expect(matchCategory("买车100000")).toBe("交通");
  });

  it('matches "买车99999.99" to 交通', () => {
    expect(matchCategory("买车99999.99")).toBe("交通");
  });

  // 纯数字关键词仍然有效
  it('matches "10086" to 通讯 (boundary match)', () => {
    expect(matchCategory("10086")).toBe("通讯");
  });

  it('matches "10010" to 通讯 (boundary match)', () => {
    expect(matchCategory("10010")).toBe("通讯");
  });

  it('matches "10000" to 通讯 (exact, not inside larger number)', () => {
    expect(matchCategory("10000")).toBe("通讯");
  });

  it('does not match "10000" inside "210000"', () => {
    expect(matchCategory("210000")).not.toBe("通讯");
  });

  // 常规文字关键词
  it('matches "话费100" to 通讯', () => {
    expect(matchCategory("话费100")).toBe("通讯");
  });

  it('matches "咖啡25" to 餐饮', () => {
    expect(matchCategory("咖啡25")).toBe("餐饮");
  });

  // 无匹配返回 null
  it("returns null for unrecognized input", () => {
    expect(matchCategory("12345")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(matchCategory("")).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd apps/mobile && npx jest lib/rule-engine/match-category.test.ts`
Expected: FAIL — "买车100000" 返回 "通讯" 而非 "交通"

- [ ] **Step 3: 实现两阶段匹配**

将 `apps/mobile/lib/rule-engine/match-category.ts` 修改为：

```typescript
import { EXPENSE_KEYWORDS } from "./keywords";
import { stripAmount } from "./strip-amount";

/** 判断关键词是否为纯数字 */
function isNumericKeyword(kw: string): boolean {
  return /^\d+$/.test(kw);
}

export function matchCategory(text: string): string | null {
  // 阶段 1：纯数字关键词用边界匹配（前后不能是数字）
  for (const [category, keywords] of Object.entries(EXPENSE_KEYWORDS)) {
    for (const kw of keywords) {
      if (!isNumericKeyword(kw)) continue;
      const pattern = new RegExp(`(?<!\\d)${kw}(?!\\d)`);
      if (pattern.test(text)) return category;
    }
  }

  // 阶段 2：剥离数字后，对文字关键词做子串匹配
  const stripped = stripAmount(text);
  if (!stripped) return null;

  for (const [category, keywords] of Object.entries(EXPENSE_KEYWORDS)) {
    if (keywords.some((kw) => !isNumericKeyword(kw) && stripped.includes(kw))) {
      return category;
    }
  }

  return null;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd apps/mobile && npx jest lib/rule-engine/match-category.test.ts`
Expected: PASS — 11 tests passed

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/lib/rule-engine/match-category.ts apps/mobile/lib/rule-engine/match-category.test.ts
git commit -m "fix: two-phase keyword matching to prevent numeric substring false positives"
```

---

### Task 3: 补充关键词 + 去重 + 修复 isIncome

**Files:**
- Modify: `apps/mobile/lib/rule-engine/keywords.ts`
- Modify: `apps/mobile/lib/rule-engine/index.ts`
- Create: `apps/mobile/lib/rule-engine/index.test.ts`

- [ ] **Step 1: 写 parse() 集成测试**

```typescript
// apps/mobile/lib/rule-engine/index.test.ts
import { parse } from "./index";

describe("parse", () => {
  // Bug fix 验证
  it('parses "买车100000" as 交通 expense', () => {
    const result = parse("买车100000");
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(100000);
    expect(result!.categoryName).toBe("交通");
    expect(result!.type).toBe("expense");
  });

  it('parses "话费100" as 通讯 expense', () => {
    const result = parse("话费100");
    expect(result).not.toBeNull();
    expect(result!.categoryName).toBe("通讯");
  });

  // 新增关键词
  it('parses "提车50000" as 交通', () => {
    const result = parse("提车50000");
    expect(result).not.toBeNull();
    expect(result!.categoryName).toBe("交通");
  });

  it('parses "买房2000000" as 居住', () => {
    const result = parse("买房2000000");
    expect(result).not.toBeNull();
    expect(result!.categoryName).toBe("居住");
  });

  // 收入识别（isIncome 也不应被数字干扰）
  it('parses "工资10000" as income', () => {
    const result = parse("工资10000");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("income");
    expect(result!.amount).toBe(10000);
  });

  // 无关键词 → 默认
  it('parses "366666" with no category', () => {
    const result = parse("366666");
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(366666);
    expect(result!.categoryName).toBeNull();
  });

  // 空输入
  it("returns null for empty string", () => {
    expect(parse("")).toBeNull();
  });

  it("returns null for text without amount", () => {
    expect(parse("你好")).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd apps/mobile && npx jest lib/rule-engine/index.test.ts`
Expected: FAIL — "买车100000" 返回 "通讯"；"买房" 无匹配

- [ ] **Step 3: 修改 keywords.ts — 补充关键词 + 去重**

在 `apps/mobile/lib/rule-engine/keywords.ts` 中：

**交通分类**（第 57-59 行，"口语"注释后面）追加：
```typescript
    "买车", "提车", "订车", "车贷",
```

**居住分类**（"押金", "中介费", "首付" 那行后面）追加（注意 `首付` 已存在，只加 `买房`）：
```typescript
    "买房",
```

**通讯分类**（第 185 行）移除 `"月租"`：
```typescript
    // 修改前：
    "流量", "流量包", "流量费", "充流量", "套餐费", "月租",
    // 修改后：
    "流量", "流量包", "流量费", "充流量", "套餐费",
```

- [ ] **Step 4: 修改 index.ts — isIncome 使用 stripAmount**

将 `apps/mobile/lib/rule-engine/index.ts` 修改为：

```typescript
import { extractAmount } from "./extract-amount";
import { matchCategory } from "./match-category";
import { stripAmount } from "./strip-amount";
import { INCOME_KEYWORDS } from "./keywords";

export interface ParseResult {
  readonly amount: number;
  readonly type: "expense" | "income";
  readonly categoryName: string | null;
  readonly note: string;
}

export function parse(text: string): ParseResult | null {
  if (!text.trim()) return null;

  const amount = extractAmount(text);
  if (amount === null) return null;

  const stripped = stripAmount(text);
  const isIncome = INCOME_KEYWORDS.some((kw) => stripped.includes(kw));
  const categoryName = matchCategory(text);

  const note = text
    .replace(/[¥￥]?\d+\.?\d{0,2}\s*(元|块)?/g, "")
    .trim() || text.trim();

  return {
    amount,
    type: isIncome ? "income" : "expense",
    categoryName,
    note,
  };
}
```

- [ ] **Step 5: 运行全部规则引擎测试**

Run: `cd apps/mobile && npx jest lib/rule-engine/`
Expected: PASS — 所有测试通过（strip-amount 7 + match-category 11 + index 8 = 26 tests）

- [ ] **Step 6: 提交**

```bash
git add apps/mobile/lib/rule-engine/keywords.ts apps/mobile/lib/rule-engine/index.ts apps/mobile/lib/rule-engine/index.test.ts
git commit -m "fix: add missing keywords, deduplicate 月租, use stripAmount in isIncome check"
```

---

### Task 4: 创建 formatAmount 工具函数

**Files:**
- Create: `apps/mobile/lib/format.ts`
- Create: `apps/mobile/lib/format.test.ts`

- [ ] **Step 1: 写 formatAmount 测试**

```typescript
// apps/mobile/lib/format.test.ts
import { formatAmount } from "./format";

describe("formatAmount", () => {
  it("formats expense with minus, ¥, and thousands separator", () => {
    expect(formatAmount(366666, "expense")).toBe("-¥366,666.00");
  });

  it("formats income with plus, ¥, and thousands separator", () => {
    expect(formatAmount(5000, "income")).toBe("+¥5,000.00");
  });

  it("formats small amounts", () => {
    expect(formatAmount(25, "expense")).toBe("-¥25.00");
  });

  it("formats decimal amounts", () => {
    expect(formatAmount(99.5, "expense")).toBe("-¥99.50");
  });

  it("formats large amounts", () => {
    expect(formatAmount(99999999, "expense")).toBe("-¥99,999,999.00");
  });

  it("formats zero", () => {
    expect(formatAmount(0, "expense")).toBe("-¥0.00");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd apps/mobile && npx jest lib/format.test.ts`
Expected: FAIL — Cannot find module './format'

- [ ] **Step 3: 实现 formatAmount**

使用手动千位分隔（避免 `toLocaleString` 在不同 Node.js 环境下 ICU 数据缺失问题）：

```typescript
// apps/mobile/lib/format.ts

/**
 * 格式化金额为带符号、¥前缀、千位分隔的字符串。
 * 使用手动格式化确保跨环境一致性。
 * 示例：formatAmount(366666, "expense") → "-¥366,666.00"
 */
export function formatAmount(
  amount: number,
  type: "income" | "expense",
): string {
  const prefix = type === "expense" ? "-¥" : "+¥";
  const fixed = amount.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${prefix}${withCommas}.${decPart}`;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd apps/mobile && npx jest lib/format.test.ts`
Expected: PASS — 6 tests passed

- [ ] **Step 5: 提交**

```bash
git add apps/mobile/lib/format.ts apps/mobile/lib/format.test.ts
git commit -m "feat: add formatAmount utility with thousands separator"
```

---

### Task 5: 创建 MAJOR_AMOUNT_THRESHOLD 常量

**Files:**
- Create: `packages/shared/src/constants/transaction.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: 创建常量文件**

```typescript
// packages/shared/src/constants/transaction.ts
export const MAJOR_AMOUNT_THRESHOLD = 5000;
```

- [ ] **Step 2: 导出常量**

在 `packages/shared/src/index.ts` 末尾追加：

```typescript
export * from "./constants/transaction";
```

- [ ] **Step 3: 验证类型检查**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add packages/shared/src/constants/transaction.ts packages/shared/src/index.ts
git commit -m "feat: add MAJOR_AMOUNT_THRESHOLD constant (5000)"
```

---

### Task 6: 修复 ChatBubble 卡片宽度

**Files:**
- Modify: `apps/mobile/components/chat/ChatBubble.tsx:172-174`

- [ ] **Step 1: 修改 rowCard maxWidth**

在 `apps/mobile/components/chat/ChatBubble.tsx` 第 172-174 行，将：

```typescript
  rowCard: {
    maxWidth: '95%',
  },
```

改为：

```typescript
  rowCard: {
    maxWidth: '100%',
  },
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/components/chat/ChatBubble.tsx
git commit -m "fix: widen RecordCard row to 100% to prevent overflow on large amounts"
```

---

### Task 7: 更新 RecordCard — 统一格式化 + 缩放兜底 + 大宗标签

**Depends on:** Task 4 (formatAmount), Task 5 (MAJOR_AMOUNT_THRESHOLD)

**Files:**
- Modify: `apps/mobile/components/chat/RecordCard.tsx`

- [ ] **Step 1: 更新 RecordCard**

将 `apps/mobile/components/chat/RecordCard.tsx` 替换为：

```tsx
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { AppText } from '../ui/AppText';
import { Badge } from '../ui/Badge';
import { colors, radii, spacing } from '../../constants/theme';
import { formatAmount } from '../../lib/format';
import { MAJOR_AMOUNT_THRESHOLD } from '@coco/shared';
import type { Transaction } from '@coco/shared';

interface RecordCardProps {
  readonly transaction: Transaction;
  readonly categoryName?: string;
  readonly categoryIcon?: string;
  readonly onEdit?: () => void;
  readonly onDelete?: () => void;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`;
}

export function RecordCard({ transaction, categoryName, categoryIcon, onEdit, onDelete }: RecordCardProps) {
  const isExpense = transaction.type === 'expense';
  const amountStr = formatAmount(transaction.amount, transaction.type);
  const isMajor = isExpense && transaction.amount >= MAJOR_AMOUNT_THRESHOLD;

  return (
    <View style={styles.card}>
      {/* Top row: icon + category/note + amount */}
      <View style={styles.topRow}>
        <View style={styles.iconBox}>
          <AppText size="xl">{categoryIcon ?? '📦'}</AppText>
        </View>
        <View style={styles.info}>
          <View style={styles.categoryRow}>
            <AppText size="lg" weight="semibold" color={colors.text}>
              {categoryName ?? '未知'}
            </AppText>
            {isMajor ? <Badge text="大宗" variant="pro" /> : null}
          </View>
          {transaction.note ? (
            <AppText size="base" color={colors.textLighter}>{transaction.note}</AppText>
          ) : null}
        </View>
        <AppText
          size="2xl"
          weight="bold"
          color={isExpense ? colors.coral : colors.sage}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {amountStr}
        </AppText>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Bottom row: date + actions */}
      <View style={styles.bottomRow}>
        <AppText size="base" color={colors.textLighter}>
          {formatDate(transaction.occurred_at)}
        </AppText>
        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              Alert.alert("删除记录", "确定要删除这笔记账吗？", [
                { text: "取消", style: "cancel" },
                { text: "删除", style: "destructive", onPress: onDelete },
              ]);
            }}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.btnPressed]}
          >
            <AppText size="base">🗑</AppText>
          </Pressable>
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.btnPressed]}
          >
            <AppText size="base" color={colors.textLight}>✏ 编辑</AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.creamDark,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },

  // Top: [icon] [category/note] [amount]
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.creamDark,
    marginVertical: spacing.lg,
  },

  // Bottom: [date] [trash] [edit]
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  actionBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  btnPressed: {
    opacity: 0.6,
  },
});
```

**改动说明**：
- 新增 import: `Badge`, `formatAmount`, `MAJOR_AMOUNT_THRESHOLD`
- `amountStr` 从 `toFixed(2)` 改用 `formatAmount()`
- 新增 `isMajor` 计算属性
- 新增 `categoryRow` 容器放分类名 + Badge
- 金额文本添加 `numberOfLines={1}` + `adjustsFontSizeToFit`
- 新增 `categoryRow` 样式

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/components/chat/RecordCard.tsx
git commit -m "feat: RecordCard uses formatAmount, adjustsFontSizeToFit, and major expense badge"
```

---

### Task 8: 更新 TransactionItem — 统一格式化 + 大宗标签

**Depends on:** Task 4 (formatAmount), Task 5 (MAJOR_AMOUNT_THRESHOLD)

**Files:**
- Modify: `apps/mobile/components/shared/TransactionItem.tsx`

- [ ] **Step 1: 更新 TransactionItem**

将 `apps/mobile/components/shared/TransactionItem.tsx` 替换为：

```tsx
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { IconBox } from '../ui/IconBox';
import { Badge } from '../ui/Badge';
import { colors, radii, shadows, type CategoryColorName } from '../../constants/theme';
import { formatAmount } from '../../lib/format';
import { MAJOR_AMOUNT_THRESHOLD } from '@coco/shared';
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
  const amountColor = isIncome ? colors.sage : colors.text;
  const time = new Date(transaction.occurred_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const isAi = transaction.source === 'text' || transaction.source === 'asr' || transaction.source === 'ocr';
  const isMajor = !isIncome && transaction.amount >= MAJOR_AMOUNT_THRESHOLD;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <IconBox emoji={categoryIcon} colorName={categoryColor} />
      <View style={styles.info}>
        <AppText size="lg" weight="semibold">{transaction.note || categoryName}</AppText>
        <View style={styles.meta}>
          <AppText size="base" color={colors.textLighter}>{time} · {categoryName}</AppText>
          {isAi ? <Badge text="AI" variant="ai" /> : null}
          {isMajor ? <Badge text="大宗" variant="pro" /> : null}
        </View>
      </View>
      <AppText size="xl" weight="bold" color={amountColor}>
        {formatAmount(transaction.amount, transaction.type)}
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

**改动说明**：
- 新增 import: `formatAmount`, `MAJOR_AMOUNT_THRESHOLD`
- 移除 `amountPrefix` 变量，金额改用 `formatAmount()`
- 新增 `isMajor` 计算属性（仅支出）
- meta 行新增 Badge 渲染

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/components/shared/TransactionItem.tsx
git commit -m "feat: TransactionItem uses formatAmount and shows major expense badge"
```

---

### Task 9: 全量回归测试

- [ ] **Step 1: 运行全部测试**

Run: `cd apps/mobile && npx jest --verbose`
Expected: PASS — 所有测试通过

- [ ] **Step 2: TypeScript 类型检查**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 手动冒烟测试（如有 dev server）**

验证以下输入：
1. "买车100000" → 交通分类 + 大宗标签 + 金额显示 "-¥100,000.00"
2. "366666" → 其他支出 + 大宗标签 + 卡片不溢出
3. "咖啡25" → 餐饮 + 无大宗标签 + 金额 "-¥25.00"
4. "话费100" → 通讯 + 无大宗标签
5. "工资10000" → 收入 + 无大宗标签 + 金额 "+¥10,000.00"

- [ ] **Step 4: 最终提交（如有修复）**

```bash
git add -A && git commit -m "fix: address issues found during regression testing"
```

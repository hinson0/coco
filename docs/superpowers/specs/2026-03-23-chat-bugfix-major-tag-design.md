# 聊天记账 Bug 修复 + 大宗消费标签

## 背景

用户报告两个 Bug，同时提出一个新需求：

1. **分类误匹配**：输入"买车100000"被归为"通讯"分类
2. **卡片溢出**：输入大额数字（如 366666）导致 RecordCard 布局撑爆
3. **大宗消费标签**：金额 ≥ 5000 的支出需要额外标注"大宗"

## 修复 1：关键词匹配误命中数字

### 根因

`match-category.ts` 中 `text.includes(kw)` 会在数字部分产生误匹配。"买车100000" 中的数字 `100000` 包含子串 `10000`（中国电信客服号，属于"通讯"关键词），导致分类错误。

同时，"买车"不在任何分类关键词表中，无法被正确匹配。

此外，`parse()` 中的 `isIncome` 检测也使用 `text.includes(kw)`，存在同样的数字子串误匹配风险。

### 方案

**两阶段匹配策略**：

1. **先对原始文本做纯数字关键词的精确匹配**：对 `10086`、`10010`、`10000`、`120` 等纯数字关键词，用正则做边界匹配（前后不能是数字），避免 `100000` 误命中 `10000`
2. **再对剥离数字后的文本做文字关键词的子串匹配**：去掉 `¥?\d+\.?\d*` 后做常规 `includes`

**提取共用工具函数**：将数字剥离逻辑提取为 `stripAmount(text)` 工具函数，在 `matchCategory` 和 `parse` 的 `isIncome` 判断中统一使用。

**涉及文件**：
- `apps/mobile/lib/rule-engine/match-category.ts` — 两阶段匹配
- `apps/mobile/lib/rule-engine/index.ts` — isIncome 判断同步使用 `stripAmount`
- `apps/mobile/lib/rule-engine/strip-amount.ts`（新建）— 共用数字剥离函数
- `apps/mobile/lib/rule-engine/keywords.ts` — 补充缺失关键词

**关键词补充**：
- 交通：`买车`、`提车`、`订车`、`车贷`
- 居住：`买房`、`首付款`

**修复后流程**：
```
"买车100000"
  → 阶段1：纯数字关键词边界匹配 → "10000" 边界检查失败（后面还有 0）→ 跳过
  → 阶段2：剥离数字 → "买车" → 命中交通分类 ✅

"10086"
  → 阶段1：纯数字关键词 "10086" 边界匹配 → 成功 → 命中通讯分类 ✅

"话费100"
  → 阶段1：纯数字关键词边界匹配 → 无命中
  → 阶段2：剥离数字 → "话费" → 命中通讯分类 ✅
```

### 纯数字关键词识别

在 keywords.ts 中，纯数字关键词为：`10086`、`10010`、`10000`（通讯）、`120`（医疗）。匹配规则为正则 `(?<!\d)keyword(?!\d)`，确保前后无相邻数字。

## 修复 2：大额数字撑爆卡片

### 根因

`ChatBubble.tsx` 中 `rowCard` 的 `maxWidth: '95%'` 加上左侧头像（36px + 8px 间距），卡片实际可用宽度受限。`RecordCard` 用 `size="2xl"` + `.toFixed(2)` 渲染金额（如 `-366666.00`，10 字符），在窄卡片上溢出。

注意：`rowCard` 的 `maxWidth` 会覆盖 `rowAssistant` 的 `maxWidth: '85%'`（React Native 数组样式后者优先），所以改为 `100%` 后卡片行可占满全宽。

### 方案

**加宽卡片 + 千位分隔 + 弹性缩放兜底**：

1. `ChatBubble.tsx` — 将 `rowCard.maxWidth` 从 `95%` 改为 `100%`
2. `RecordCard.tsx` — 金额格式化改用统一工具函数，增加千位分隔符
3. `RecordCard.tsx` — 金额文本添加 `numberOfLines={1}` + `adjustsFontSizeToFit` 作为极端情况兜底

**统一金额格式化**：提取 `formatAmount(amount, type)` 工具函数，所有组件（`RecordCard`、`TransactionItem`、`DayGroup`）统一使用：
```typescript
// 输出示例："-366,666.00"、"+5,000.00"
function formatAmount(amount: number, type: 'income' | 'expense'): string {
  const prefix = type === 'expense' ? '-' : '+';
  return `${prefix}${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
```

**涉及文件**：
- `apps/mobile/components/chat/ChatBubble.tsx` — rowCard maxWidth → 100%
- `apps/mobile/components/chat/RecordCard.tsx` — 使用统一格式化 + adjustsFontSizeToFit
- `apps/mobile/components/shared/TransactionItem.tsx` — 使用统一格式化
- `apps/mobile/lib/format.ts`（新建）— formatAmount 工具函数

## 新增：大宗消费标签

### 需求

- 金额 ≥ 5000 的**支出**交易显示"大宗"标签（收入不标注）
- 关键词决定分类不变，金额只决定是否打标签
- 纯 UI 层面，不改数据库

### 方案

**计算属性 + Badge 组件**：

1. `packages/shared/src/constants/transaction.ts`（新建）— 阈值常量 `MAJOR_AMOUNT_THRESHOLD = 5000`
2. `RecordCard.tsx` — 判定 `amount >= 5000 && type === 'expense'` 时渲染 Badge
3. `TransactionItem.tsx` — 账单列表同步显示
4. 复用现有 `Badge` 组件的 `pro` 变体（`honeyPale` 背景 + `honey` 文字），配色完全符合需求，无需新增变体

**卡片布局示意**：
```
┌─────────────────────────────────────────┐
│ [🚗] 交通  [大宗]         -100,000.00   │
│       买车                               │
├─────────────────────────────────────────┤
│ 2026年03月22日           🗑   ✏ 编辑    │
└─────────────────────────────────────────┘
```

**判定逻辑**：
```typescript
const isMajor = transaction.type === 'expense'
  && transaction.amount >= MAJOR_AMOUNT_THRESHOLD;
```

## 涉及文件汇总

| 文件 | 改动 |
|------|------|
| `apps/mobile/lib/rule-engine/match-category.ts` | 两阶段匹配（纯数字边界 + 剥离后子串） |
| `apps/mobile/lib/rule-engine/index.ts` | isIncome 判断使用 stripAmount |
| `apps/mobile/lib/rule-engine/strip-amount.ts`（新建） | 共用数字剥离函数 |
| `apps/mobile/lib/rule-engine/keywords.ts` | 补充买车/买房等关键词 |
| `apps/mobile/lib/format.ts`（新建） | formatAmount 统一金额格式化 |
| `apps/mobile/components/chat/ChatBubble.tsx` | rowCard maxWidth → 100% |
| `apps/mobile/components/chat/RecordCard.tsx` | 统一格式化 + adjustsFontSizeToFit + 大宗标签 |
| `apps/mobile/components/shared/TransactionItem.tsx` | 统一格式化 + 大宗标签 |
| `packages/shared/src/constants/transaction.ts`（新建） | MAJOR_AMOUNT_THRESHOLD |
| `packages/shared/src/index.ts` | 导出新常量 |

## 测试要点

### 分类匹配
- 输入"买车100000" → 交通分类 ✅（"10000"不再误命中通讯）
- 输入"话费100" → 通讯分类 ✅（"话费"正常匹配）
- 输入"10086" → 通讯分类 ✅（纯数字关键词边界匹配）
- 输入"10086充值" → 通讯分类 ✅（阶段1命中"10086"或阶段2命中"充值"→ 其他，但"10086"先命中）
- 输入"买车99999.99" → 交通分类 ✅（小数金额正确剥离）
- 输入"12345" → 无关键词命中 → 其他支出（默认回退）

### 卡片显示
- 金额 366666 → 显示"-366,666.00"，卡片不溢出
- 金额 25 → 显示"-25.00"，正常显示
- 金额 99999999（极端值）→ adjustsFontSizeToFit 自动缩放，不溢出

### 大宗标签
- 支出 5000 → 显示"大宗"标签（边界值，等于阈值）
- 支出 4999.99 → 不显示标签
- 支出 100000 → 显示"大宗"标签
- 收入 10000（如"工资10000"）→ 不显示标签（仅支出标注）
- 支出 25 → 不显示标签

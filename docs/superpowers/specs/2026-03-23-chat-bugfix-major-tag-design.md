# 聊天记账 Bug 修复 + 大宗消费标签

## 背景

用户报告两个 Bug，同时提出一个新需求：

1. **分类误匹配**：输入"买车100000"被归为"通讯"分类
2. **卡片溢出**：输入大额数字（如 366666）导致 RecordCard 布局撑爆
3. **大宗消费标签**：金额 ≥ 5000 的交易需要额外标注"大宗"

## 修复 1：关键词匹配误命中数字

### 根因

`match-category.ts` 中 `text.includes(kw)` 会在数字部分产生误匹配。"买车100000" 中的数字 `100000` 包含子串 `10000`（中国电信客服号，属于"通讯"关键词），导致分类错误。

同时，"买车"不在任何分类关键词表中，无法被正确匹配。

### 方案

**在匹配前剥离数字**：`matchCategory` 函数先用正则去掉文本中的金额数字，再对纯文字部分做关键词匹配。

**涉及文件**：
- `apps/mobile/lib/rule-engine/match-category.ts` — 剥离数字后再匹配
- `apps/mobile/lib/rule-engine/keywords.ts` — 补充缺失关键词

**关键词补充**：
- 交通：`买车`、`提车`、`订车`、`车贷`
- 居住：`买房`、`首付款`

**修复后流程**：
```
"买车100000"
  → 剥离数字 → "买车"
  → 遍历关键词 → 交通分类命中 "买车" ✅
```

## 修复 2：大额数字撑爆卡片

### 根因

`ChatBubble.tsx` 中 `rowCard` 的 `maxWidth: '95%'` 加上左侧头像（36px + 8px 间距），卡片实际可用宽度约 83%。`RecordCard` 用 `size="2xl"` + `.toFixed(2)` 渲染金额（如 `-366666.00`，10 字符），在窄卡片上溢出。

### 方案

**加宽卡片 + 千位分隔**：

1. `ChatBubble.tsx` — 将 `rowCard.maxWidth` 从 `95%` 改为 `100%`
2. `RecordCard.tsx` — 金额格式化增加千位分隔符：`-366666.00` → `-366,666.00`

**涉及文件**：
- `apps/mobile/components/chat/ChatBubble.tsx` — rowCard maxWidth
- `apps/mobile/components/chat/RecordCard.tsx` — 金额格式化

## 新增：大宗消费标签

### 需求

- 金额 ≥ 5000 的交易显示"大宗"标签
- 关键词决定分类不变，金额只决定是否打标签
- 纯 UI 层面，不改数据库

### 方案

**计算属性 + UI 标签**：

1. `packages/shared/src/constants/` 新增阈值常量 `MAJOR_AMOUNT_THRESHOLD = 5000`
2. `RecordCard.tsx` — `amount >= 5000` 时在分类名旁渲染"大宗"标签
3. `TransactionItem.tsx` — 账单列表同步显示"大宗"标签
4. 标签配色使用 `honey` 色系（金黄背景 + 深金文字）

**卡片布局示意**：
```
┌─────────────────────────────────────┐
│ [🚗] 交通  [大宗]     -100,000.00   │
│       买车                           │
├─────────────────────────────────────┤
│ 2026年03月22日       🗑   ✏ 编辑    │
└─────────────────────────────────────┘
```

**判定逻辑**：
```typescript
const isMajor = transaction.amount >= MAJOR_AMOUNT_THRESHOLD;
```

## 涉及文件汇总

| 文件 | 改动 |
|------|------|
| `apps/mobile/lib/rule-engine/match-category.ts` | 剥离数字后匹配 |
| `apps/mobile/lib/rule-engine/keywords.ts` | 补充买车/买房等关键词 |
| `apps/mobile/components/chat/ChatBubble.tsx` | rowCard maxWidth → 100% |
| `apps/mobile/components/chat/RecordCard.tsx` | 千位分隔 + 大宗标签 |
| `apps/mobile/components/shared/TransactionItem.tsx` | 大宗标签 |
| `packages/shared/src/constants/transaction.ts`（新建） | MAJOR_AMOUNT_THRESHOLD |

## 测试要点

- 输入"买车100000" → 交通分类，金额 100000，显示大宗标签
- 输入"366666" → 其他支出分类，金额 366666，卡片不溢出，显示大宗标签
- 输入"咖啡25" → 餐饮分类，无大宗标签
- 输入"话费100" → 通讯分类（"10000"不再误匹配）
- 输入"10086" → 通讯分类（纯数字输入需验证行为）

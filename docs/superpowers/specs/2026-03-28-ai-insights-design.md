# AI 洞察功能设计文档

## 概述

为 CoCo 记账 App 的统计页面实现"AI 洞察"模块，基于用户的本地交易数据，通过纯本地规则计算生成智能洞察卡片，帮助用户快速了解消费状况和潜在问题。

**核心原则**：
- 纯本地计算，不调用 LLM，离线可用，零延迟
- 按需显示——只在有值得说的事情时才出现，避免信息噪音
- 冷启动友好——无上月数据时仍能展示部分洞察

## 数据架构

### 输入：InsightContext

规则引擎接收的统一上下文对象：

```typescript
interface InsightContext {
  currentMonth: Transaction[]     // 本月交易
  previousMonth: Transaction[]    // 上月交易（可能为空数组）
  categories: Category[]          // 分类列表
  year: number
  month: number
  daysInMonth: number             // 本月总天数
  daysElapsed: number             // 本月已过天数
}
```

### 输出：InsightItem

每条规则返回 `InsightItem | null`，null 表示该洞察不值得展示：

```typescript
interface InsightItem {
  type: 'health' | 'category-change' | 'anomaly' | 'pace' | 'frequency' | 'saving'
  priority: number                // 越小越靠前
  emoji: string
  title: string
  desc: string
  badge?: { text: string; direction: 'up' | 'down' | 'neutral' }
  navigation?: {
    route: string
    params: Record<string, string>
  }
  meta?: Record<string, any>      // 可视化所需的原始数据
}
```

设计意图：
- `type` 让 UI 层知道用哪种卡片模板渲染
- `priority` 支持排序，最重要的排最前
- `meta` 存放可视化原始数据（如金额对比、分数、频率点等），避免在规则里硬编码 UI 细节

## 规则定义

采用规则引擎模式：每种洞察是一个独立的纯函数，统一接口，独立可测试。

### 1. 健康度评分 `healthScoreRule`

- **始终显示**（唯一的例外，其他规则都是按需）
- **priority**: 1
- **无需上月数据**

计算公式（总分 0-100）：
- 结余率分（权重 60%）：结余/收入，0% → 0分，≥30% → 100分，线性插值
- 消费节奏分（权重 20%）：实际消费进度 vs 理想进度（已过天数/总天数），偏差越大分越低
- 异常交易分（权重 20%）：0 笔异常 → 100分，每多一笔扣 25 分

评级映射：
- 0-40: 差
- 41-60: 一般
- 61-80: 良好
- 81-100: 优秀

meta 数据：`{ score, level, savingsRate, prevSavingsRate? }`

### 2. 分类环比变化 `categoryChangeRule`

- **需要上月数据**，否则返回 null
- **priority**: 涨幅卡 = 2，降幅卡 = 5

触发条件（同时满足）：
- 变化幅度 ≥ 15%
- 绝对差额 ≥ ¥50

规则逻辑：
- 对每个支出分类计算本月 vs 上月金额
- 按变化幅度排序
- 最多生成 2 条（最大涨幅 + 最大降幅各一条）

meta 数据：`{ categoryId, currentAmount, previousAmount, changePercent }`

点击跳转：category-detail 页面

### 3. 异常交易检测 `anomalyRule`

- **无需上月数据**
- **priority**: 3

触发条件（同时满足）：
- 交易金额 > 本月支出中位数 + 2 倍标准差
- 交易金额 ≥ ¥500

规则逻辑：
- 计算本月所有支出交易的中位数和标准差
- 找出超过阈值的交易
- 只取金额最大的一笔展示

meta 数据：`{ transactionId, amount, categoryEmoji, categoryName, date }`

点击跳转：该交易对应的分类详情页

### 4. 消费节奏 `paceRule`

- **无需上月数据**
- **priority**: 4

触发条件（同时满足）：
- 消费进度超过时间进度 15 个百分点以上
- 已过月初至少 5 天（避免月初噪音）

计算逻辑：
- 时间进度 = 已过天数 / 总天数
- 消费进度 = 已消费金额 / (日均支出 × 总天数)
- 偏差 = 消费进度 - 时间进度

meta 数据：`{ timeProgress, spendProgress, estimatedMonthTotal }`

### 5. 高频消费 `frequencyRule`

- **无需上月数据**
- **priority**: 6

触发条件：
- 某分类消费次数 ≥ 8 次/月

规则逻辑：
- 按分类统计本月支出笔数
- 取频次最高的一个分类
- 计算该分类的累计金额

meta 数据：`{ categoryId, categoryEmoji, categoryName, count, totalAmount }`

### 6. 节省建议 `savingRule`

- **依赖前序规则结果**
- **priority**: 7（始终排最后）

触发条件：
- 前面规则中存在分类环比增长或高频消费
- 预估节省金额 ≥ ¥50

计算逻辑：
- 如果有分类环比增长：建议减少 N 次该分类消费，N × 单次均价 = 预估节省
- 如果有高频消费：建议减少 M 次，M × 单次均价 = 预估节省
- 合并多条建议的总节省金额

meta 数据：`{ suggestions: [{ category, reduceCount, saveAmount }], totalSaving }`

## 规则执行流程

```
InsightContext
  → 并行执行 [healthScoreRule, categoryChangeRule, anomalyRule, paceRule, frequencyRule]
  → 收集非 null 结果
  → savingRule(context, 前序结果)    // 依赖前序结果生成节省建议
  → 合并所有结果 → 按 priority 升序排序
  → 返回 InsightItem[]
```

## UI 组件设计

### 组件结构

```
TrendInsightRow (容器，标题"AI 洞察")
  ├── HealthScoreCard          // type=health 专用（圆环布局）
  ├── InsightCard (通用外壳)   // 其他 type 共用
  │    ├── 左侧色条（按 type 着色）
  │    ├── emoji 图标区
  │    ├── 标题行 + badge
  │    ├── 描述文字
  │    └── 可视化插槽（按 type 条件渲染）
  └── 空状态文字               // 仅健康度时显示
```

`HealthScoreCard` 单独拆出来（布局差异大），其他 5 种共用 `InsightCard`，内部按 type 条件渲染可视化部分。

### 卡片模板与可视化

| type | 左侧色条 | 可视化元素 |
|------|----------|-----------|
| `health` | — | 分数圆环 + 评级文字 + 环比标签 |
| `category-change` (up) | 红色 | 本月/上月金额对比块 |
| `category-change` (down) | 绿色 | 条形图对比 |
| `anomaly` | 紫色 | 金额高亮 + 分类 + 日期 |
| `pace` | 红色 | 进度条 + 理想进度标记 + 百分比 |
| `frequency` | 蓝色 | 圆点频率可视化 + 次数 |
| `saving` | 橙色 | 节省金额高亮 + 生活化类比 |

### 点击交互

- 卡片外层 `Pressable`，`onPress` 根据 `navigation` 字段调用 `router.push(route, params)`
- 没有 `navigation` 的卡片（如节省建议、健康度）不响应点击

### 空状态

当规则引擎只返回健康度卡片（其他一切正常）时，健康度卡片下方显示淡色文字：
> "本月消费表现不错，暂无需要关注的问题 👍"

## 文件结构

```
apps/mobile/
├── utils/
│   ├── insights/
│   │   ├── types.ts              // InsightContext, InsightItem 类型
│   │   ├── healthScoreRule.ts
│   │   ├── categoryChangeRule.ts
│   │   ├── anomalyRule.ts
│   │   ├── paceRule.ts
│   │   ├── frequencyRule.ts
│   │   ├── savingRule.ts
│   │   ├── runInsightRules.ts    // 调度器：执行所有规则、排序
│   │   └── __tests__/
│   │       ├── healthScoreRule.test.ts
│   │       ├── categoryChangeRule.test.ts
│   │       ├── anomalyRule.test.ts
│   │       ├── paceRule.test.ts
│   │       ├── frequencyRule.test.ts
│   │       ├── savingRule.test.ts
│   │       └── runInsightRules.test.ts
├── components/stats/
│   ├── TrendInsightRow.tsx       // 改造：接收 InsightItem[] 渲染
│   ├── HealthScoreCard.tsx       // 新增：圆环评分卡片
│   └── InsightCard.tsx           // 新增：通用洞察卡片（含可视化插槽）
└── app/(tabs)/stats.tsx          // 改造：调用 runInsightRules 替换硬编码数据
```

## 数据获取

Stats 页面已有 `useMonthlyTransactions(year, month)` 获取当月交易。需新增获取上月交易：

```typescript
const current = useMonthlyTransactions(year, month)
const prev = useMonthlyTransactions(prevYear, prevMonth)
```

在 `useMemo` 中调用 `runInsightRules(context)` 生成洞察列表，传入 `TrendInsightRow`。

## UI 参考

高保真 mockup 见 `docs/mockups/ai-insights-mockup.html`

# 自动记账补齐收入识别能力

## Context

CoCo 当前的自动记账链路（文字/语音/OCR）无论用户说什么都会被记作"支出"，即使用户明显在描述收入（例如"发工资 8000"、"退款 50"、"到账 1200"）。手动记账、通知解析（微信/支付宝原生推送）以及统计页面都已经正确区分 `income` / `expense`，问题只出在**后端 LLM 提示词**上：

| 文件:行号 | 现状 | 问题 |
| --- | --- | --- |
| `apps/backend/services/silicon.py:73-92` `extract_bill()` | prompt 只声明 `"type": "expense"\|"income"` 但**没有任何判定规则** | LLM 只能按训练先验猜，遇到"发工资 8000"大概率猜成 expense |
| `apps/backend/services/silicon.py:95-118` `extract_bill_from_receipt()` | prompt 明确写 `type：通常为 "expense"` | 强引导 LLM 永远输出 expense，即使 OCR 出现退款/工资条也不例外 |

已确认不需要动的层（通过 Explore agent 交叉验证）：

- 数据库枚举 `transaction_type` 已支持 income/expense（`alembic/versions/88e885d59ac9_initial_schema.py:20`）
- 默认分类已包含工资/理财/其他收入（同上 L102-116）
- TypeScript 类型 `TransactionType = "income" | "expense"`（`packages/shared/src/types/category.ts:1`）
- 前端 `useChat.ts` 三个入口（文字/语音/OCR）都直接透传 `tx.type` 到 `createTransaction`，不需要改
- RecordCard 金额正负号 / 颜色已按 `transaction.type` 正确渲染

用户已确认本次**只改后端 prompt**，不加后端关键词兜底校验，也不加前端 RecordCard 快速切换按钮（如有需要可后续迭代）。兜底策略保持"LLM 拿不准时默认 expense"的最宽松行为。

## 方案

### 改动点 1：`extract_bill()` prompt 补齐 type 判定规则

**文件**：`apps/backend/services/silicon.py:73-92`

在 prompt 里加入：
- **type 判定规则**：先列"收入关键词优先"、"否则默认 expense"的两段式规则（对齐前端 `parser.ts:46-59` 的"收入优先→支出其次"思路，但因为是中文自然语句不是通知模板，用关键词列表 + 少量示例）
- **收入关键词表**：`工资/奖金/年终奖/红包/收到/到账/转入/退款/退货款/报销/补贴/分红/利息/理财收益/卖掉/转卖`
  - 注：合并参考 `apps/mobile/lib/auto-bookkeeping/parser.ts:23` 的 `INCOME_KEYWORDS` 和默认分类表里的 income 类（工资/理财/其他收入）
- **支出关键词补充**：`花/买/付/支付/消费/充值/订阅/缴`
- **few-shot 示例**：给两个收入例子（"今天发工资 8000"→income、"朋友微信转我 500 请吃饭"→expense 因为是代付）+ 一个支出例子，让 LLM 学到边界
- **兜底规则**：实在判断不出来默认 expense（保留当前行为）

### 改动点 2：`extract_bill_from_receipt()` prompt 移除硬编码偏见

**文件**：`apps/backend/services/silicon.py:95-118`

- 把 **L105 `- type：通常为 "expense"`** 替换为：
  - "type：小票默认是消费凭证，一般为 `expense`；但若小票标题/内容包含**退款/退货/入账/工资/补贴/报销**等关键词，应为 `income`"
- 这样 OCR 场景保留 expense 倾向（符合小票 99% 是消费凭证的现实），但不再屏蔽 income 可能性

### 不改

- `apps/backend/routers/chat.py:66-87` 和 `routers/ocr.py:30-38` 的 `type="income" if bill.get("type") == "income" else "expense"` 三元表达式保留——这正是"LLM 拿不准默认 expense"的最终兜底，用户明确要求保留
- 不加 Python 侧的关键词二次校验层
- 不加前端 UI 快速切换按钮

## 关键文件

| 路径 | 角色 |
| --- | --- |
| `apps/backend/services/silicon.py` | **唯一修改文件**，改 L73-92 和 L95-118 两个 prompt |
| `apps/mobile/lib/auto-bookkeeping/parser.ts` | 参考：关键词表的蓝本（L23-24），不改 |
| `apps/backend/alembic/versions/88e885d59ac9_initial_schema.py` | 参考：默认分类的 income 分组（L102-116），不改 |
| `apps/backend/routers/chat.py` / `routers/ocr.py` | 不改，保留三元表达式作兜底 |

## 验证

修改完毕后按以下步骤手动验证（需要 `SILICON_API_KEY` 环境变量和后端服务运行）：

1. **启动后端**：
   ```bash
   cd apps/backend && uv run uvicorn main:app --reload
   ```

2. **文字记账收入用例**（调用 `/chat`）：
   - "今天发工资 8000" → 期望 `type=income`、`category=工资`
   - "朋友退我 50 块钱" → 期望 `type=income`、`category=其他收入`
   - "刚收到报销 300" → 期望 `type=income`
   - "银行利息 12.5 块" → 期望 `type=income`、`category=理财`

3. **文字记账支出用例（回归）**：
   - "买了杯咖啡 30 块" → 期望 `type=expense`
   - "打车花了 45" → 期望 `type=expense`
   - "朋友微信转我 500 请吃饭"（隐含代付）→ 期望 `type=expense`

4. **文字记账歧义用例**（确认兜底行为）：
   - "50 块" → 期望 `type=expense`（LLM 拿不准 → 默认）

5. **OCR 回归**：用一张普通餐饮小票跑 `/record-ocr` → 期望仍然 `type=expense`

6. **OCR 收入场景**：用一张包含"退款/退货"字样的小票 → 期望 `type=income`

7. **前端联调**：在 mobile app 里对话输入上面几条，检查 `RecordCard` 金额显示为 `+¥` 绿色（sage）而不是 `-¥` 红色（coral），`CategoryPicker` 也应该落到 income 分类下。

## 风险与回滚

- **风险**：Qwen3-8B 对中文语义的稳定性取决于 prompt 质量，few-shot 示例如果选不好可能引入新偏见。若验证阶段发现某类表述误判，迭代 prompt 里的示例即可。
- **回滚**：改动只涉及单文件的两个字符串字面量，git revert 即可完全还原。

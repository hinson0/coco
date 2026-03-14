export function buildOcrExtractPrompt(ocrText: string): string {
  return `从以下 OCR 文本中提取记账信息，返回 JSON 格式：
{"amount": number, "category": string, "note": string, "occurred_at": string}

规则：
- amount: 金额数值，不含货币符号
- category: 从以下分类中选择最匹配的：餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
- note: 简短描述（如商户名称+商品）
- occurred_at: ISO 8601 格式日期，无法识别则返回 null

只返回 JSON，不要其他文字。

OCR文本：${ocrText}`;
}

export function buildAsrExtractPrompt(asrText: string, currentTime: string): string {
  return `从以下语音转文字内容中提取记账信息，返回 JSON 格式：
{"amount": number, "category": string, "note": string, "occurred_at": string}

规则：
- amount: 金额数值
- category: 从以下分类中选择最匹配的：餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
- note: 简短描述
- occurred_at: ISO 8601 格式，相对日期（如"昨天""今天"）请基于当前时间计算

当前时间：${currentTime}
只返回 JSON，不要其他文字。

语音内容：${asrText}`;
}

export function buildIntentClassifyPrompt(userText: string): string {
  return `判断以下用户输入的意图，返回 JSON：{"intent": "record"} 或 {"intent": "query"}。
- record：用户在描述一笔消费或收入（如"午饭35"、"打车花了20"、"收到工资5000"）
- query：用户在查询历史数据（如"上周花了多少"、"本月餐饮支出"、"这个月还剩多少预算"）

只返回 JSON，不要其他文字。

用户输入：${userText}`;
}

export function buildText2SqlPrompt(question: string, currentTime: string): string {
  return `将以下自然语言问题转换为 PostgreSQL SELECT 查询。

可用表结构：
- transactions (id, user_id, category_id, amount, type, note, occurred_at, source, created_at, deleted_at)
  - type: 'income' | 'expense'
  - deleted_at IS NULL 表示未删除
- categories (id, user_id, name, icon, type, is_default)

规则：
- 只生成 SELECT 语句
- 必须包含 WHERE deleted_at IS NULL
- 不要包含 user_id 条件（服务端自动注入）
- 使用 JOIN categories ON transactions.category_id = categories.id 来按分类名过滤
- 当前时间：${currentTime}

只返回 SQL，不要其他文字。

问题：${question}`;
}

export function buildSummarizePrompt(question: string, queryResult: string): string {
  return `用户问："${question}"

查询结果如下：
${queryResult}

请用简洁的中文自然语言回答用户的问题。如果结果为空，说"没有找到相关记录"。
包含具体数字和关键细节。`;
}

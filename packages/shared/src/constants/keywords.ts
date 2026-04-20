import keywords from "./keywords.json";

// 通知解析场景（apps/mobile/lib/auto-bookkeeping/parser.ts）：
// 精简表，只含明确的指示动词。窄匹配避免把"工资代发提醒"之类的
// 银行推广文本误识别为到账收入。
export const NOTIFICATION_INCOME_KEYWORDS: readonly string[] =
  keywords.notification.income;
export const NOTIFICATION_EXPENSE_KEYWORDS: readonly string[] =
  keywords.notification.expense;

export const NOTIFICATION_INCOME_REGEX = new RegExp(
  NOTIFICATION_INCOME_KEYWORDS.join("|"),
);
export const NOTIFICATION_EXPENSE_REGEX = new RegExp(
  NOTIFICATION_EXPENSE_KEYWORDS.join("|"),
);

// LLM 语义判断场景（apps/backend/services/silicon.py）：
// 宽表，涵盖名词短语 + 动词 + 不同行业用词，用于提示 LLM 如何
// 区分自然语言里的收入 / 支出意图。
export const SEMANTIC_INCOME_KEYWORDS: readonly string[] =
  keywords.semantic.income;
export const SEMANTIC_EXPENSE_KEYWORDS: readonly string[] =
  keywords.semantic.expense;

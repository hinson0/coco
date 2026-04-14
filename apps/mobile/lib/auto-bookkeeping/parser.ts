export type NotificationSource = "wechat" | "alipay";

export interface ParsedNotification {
  readonly amount: number;
  readonly source: NotificationSource;
  readonly type: "income" | "expense";
  readonly rawTitle: string;
  readonly rawText: string;
}

const SUPPORTED_PACKAGES: Record<string, NotificationSource> = {
  "com.tencent.mm": "wechat",
  "com.eg.android.AlipayGphone": "alipay",
};

// 匹配两种格式：「25.00元」和「¥25.00」
const AMOUNT_REGEX_SUFFIX = /([\d]+\.?\d{0,2})\s*元/;
const AMOUNT_REGEX_PREFIX = /[¥￥]([\d]+\.?\d{0,2})/;
const INCOME_KEYWORDS = /收款|到账|转入|收到/;
const EXPENSE_KEYWORDS = /付款|消费|支出|扣款|扣费|已支付/;

export function parseNotification(
  packageName: string,
  title: string,
  text: string,
): ParsedNotification | null {
  const source = SUPPORTED_PACKAGES[packageName];
  if (!source) return null;

  const combined = `${title} ${text}`;
  const amountMatch =
    combined.match(AMOUNT_REGEX_SUFFIX) ?? combined.match(AMOUNT_REGEX_PREFIX);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1]);
  if (!amount || amount <= 0) return null;

  const isIncome = INCOME_KEYWORDS.test(combined);
  const isExpense = EXPENSE_KEYWORDS.test(combined);

  // 收入关键词更明确（收款/到账），优先判断
  // 如果都不匹配，默认支出
  let type: "income" | "expense";
  if (isIncome) {
    type = "income";
  } else if (isExpense) {
    type = "expense";
  } else {
    type = "expense";
  }

  return { amount, source, type, rawTitle: title, rawText: text };
}

export function isSupportedPackage(packageName: string): boolean {
  return packageName in SUPPORTED_PACKAGES;
}

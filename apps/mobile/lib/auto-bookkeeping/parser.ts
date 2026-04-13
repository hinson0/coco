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

const AMOUNT_REGEX = /([\d]+\.?\d{0,2})\s*元/;
const INCOME_KEYWORDS = /收款|到账|转入|收到/;
const EXPENSE_KEYWORDS = /付款|消费|支出|扣款|扣费/;

export function parseNotification(
  packageName: string,
  title: string,
  text: string,
): ParsedNotification | null {
  const source = SUPPORTED_PACKAGES[packageName];
  if (!source) return null;

  const amountMatch = text.match(AMOUNT_REGEX);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1]);
  if (!amount || amount <= 0) return null;

  const isIncome = INCOME_KEYWORDS.test(text);
  const isExpense = EXPENSE_KEYWORDS.test(text);

  // 如果同时匹配收入和支出关键词（如"收款"+"扣款"），以支出为准
  // 如果都不匹配，默认支出
  let type: "income" | "expense";
  if (isExpense) {
    type = "expense";
  } else if (isIncome) {
    type = "income";
  } else {
    type = "expense";
  }

  return { amount, source, type, rawTitle: title, rawText: text };
}

export function isSupportedPackage(packageName: string): boolean {
  return packageName in SUPPORTED_PACKAGES;
}

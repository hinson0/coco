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

// 输入非法时（空串、Invalid Date）回退到今天：救 OCR 历史数据里 occurred_at="" 的坏消息
export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const target = Number.isNaN(d.getTime()) ? new Date() : d;
  return `${target.getFullYear()}年${String(target.getMonth() + 1).padStart(2, "0")}月${String(target.getDate()).padStart(2, "0")}日`;
}

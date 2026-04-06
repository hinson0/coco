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

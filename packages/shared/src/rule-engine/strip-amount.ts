/**
 * 从文本中剥离金额数字部分，返回纯文字。
 * 处理格式：¥100、￥100、100元、100块、100.50、纯数字
 */
export function stripAmount(text: string): string {
  return text.replace(/[¥￥]?\d+\.?\d{0,2}\s*(元|块)?/g, "").trim();
}

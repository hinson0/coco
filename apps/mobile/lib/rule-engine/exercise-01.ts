/**
 * 练习 1：用 TypeScript 写第一个函数
 *
 * 目标：解析简单的记账文本，提取备注和金额
 * 例如："午饭35" → { note: "午饭", amount: 35 }
 *       "打车15.5" → { note: "打车", amount: 15.5 }
 *       "hello" → null（无法解析）
 *
 * 提示：
 *   - 模式是：中文文字 + 数字（整数或小数）
 *   - 正则参考：/^([\u4e00-\u9fa5]+)(\d+\.?\d*)$/
 *     [\u4e00-\u9fa5] 匹配中文字符（≈ Python 的 \p{Han}）
 *   - text.match(regex) 返回数组 [完整匹配, 捕获组1, 捕获组2, ...] 或 null
 *   - parseFloat("35.5") 将字符串转为数字
 */

interface ParseResult {
  note: string;
  amount: number;
}

// text.match() 返回的数组结构：
// matched[0] = 完整匹配  "午饭35"     ← 你用了这个当 note
// matched[1] = 捕获组1   "午饭"       ← 应该用这个
// matched[2] = 捕获组2   "35"         ← 应该用这个

export const parseSimpleExpense = (text: string): ParseResult | null => {
  const matched = text.match(/^([\u4e00-\u9fa5]+)(\d+\.?\d*)$/);
  if (!matched) return null;

  return { note: matched[1], amount: parseFloat(matched[2]) };
};

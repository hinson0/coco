import { EXPENSE_KEYWORDS } from "./keywords";
import { stripAmount } from "./strip-amount";

/** 判断关键词是否为纯数字 */
function isNumericKeyword(kw: string): boolean {
  return /^\d+$/.test(kw);
}

export function matchCategory(text: string): string | null {
  const stripped = stripAmount(text);
  if (!stripped) return null;

  // 阶段 1：纯数字关键词用边界匹配（在去除金额后的文本上匹配，避免金额误命中）
  for (const [category, keywords] of Object.entries(EXPENSE_KEYWORDS)) {
    for (const kw of keywords) {
      if (!isNumericKeyword(kw)) continue;
      const pattern = new RegExp(`(?<!\\d)${kw}(?!\\d)`);
      if (pattern.test(stripped)) return category;
    }
  }

  // 阶段 2：对文字关键词做子串匹配
  for (const [category, keywords] of Object.entries(EXPENSE_KEYWORDS)) {
    if (keywords.some((kw) => !isNumericKeyword(kw) && stripped.includes(kw))) {
      return category;
    }
  }

  return null;
}

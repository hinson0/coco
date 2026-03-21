import { extractAmount } from "./extract-amount";
import { matchCategory } from "./match-category";
import { INCOME_KEYWORDS } from "./keywords";

export interface ParseResult {
  readonly amount: number;
  readonly type: "expense" | "income";
  readonly categoryName: string | null;
  readonly note: string;
}

export function parse(text: string): ParseResult | null {
  if (!text.trim()) return null;

  const amount = extractAmount(text);
  if (amount === null) return null;

  const isIncome = INCOME_KEYWORDS.some((kw) => text.includes(kw));
  const categoryName = matchCategory(text);

  const note = text
    .replace(/[¥￥]?\d+\.?\d{0,2}\s*(元|块)?/g, "")
    .trim() || text.trim();

  return {
    amount,
    type: isIncome ? "income" : "expense",
    categoryName,
    note,
  };
}

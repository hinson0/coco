import { extractAmount } from "./extract-amount";
import { matchCategory } from "./match-category";
import { stripAmount } from "./strip-amount";
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

  const stripped = stripAmount(text);
  const isIncome = INCOME_KEYWORDS.some((kw) => stripped.includes(kw));
  const categoryName = matchCategory(text);

  const note = text.trim();

  return {
    amount,
    type: isIncome ? "income" : "expense",
    categoryName,
    note,
  };
}

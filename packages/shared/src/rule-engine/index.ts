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

  const note = stripped
    .replace(/^[呃嗯啊哦嗨喂额那个就是][，,、\s]*/g, "")
    .replace(/花了|花费了?|消费了?|用了|支出了?/g, "")
    .replace(/钱$/, "")
    .replace(/[，。,.\s]+$/g, "")
    .trim();

  return {
    amount,
    type: isIncome ? "income" : "expense",
    categoryName,
    note,
  };
}

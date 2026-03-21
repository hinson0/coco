import { EXPENSE_KEYWORDS } from "./keywords";

export function matchCategory(text: string): string | null {
  for (const [category, keywords] of Object.entries(EXPENSE_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return category;
    }
  }
  return null;
}

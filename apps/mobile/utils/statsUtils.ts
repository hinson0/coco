import type { Transaction } from "@coco/shared";

export interface DailyDataPoint {
  date: string; // "YYYY-MM-DD"
  expense: number;
  income: number;
}

export interface CategoryStat {
  categoryId: string | null;
  emoji: string;
  name: string;
  amount: number;
  count: number;
  percent: number;
  color: string;
}

export interface RankedTransaction {
  id: string;
  categoryEmoji: string;
  categoryName: string;
  amount: number;
  date: string; // "YYYY-MM-DD"
  note?: string;
}

type Dimension = "expense" | "income" | "balance";

/** "2026年03月" — month padded to 2 digits */
export function formatMonthLabelPadded(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}年${mm}月`;
}

/** "2026年03月01日—2026年03月31日" */
export function buildDateRangeLabel(date: Date): string {
  const y = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, date.getMonth() + 1, 0).getDate();
  const dd = String(lastDay).padStart(2, "0");
  return `${y}年${mm}月01日—${y}年${mm}月${dd}日`;
}

/**
 * Days elapsed in the reference month (min 1):
 * - Current month: today.getDate()
 * - Past month: full month days
 * - Future month: 1 (prevent division by zero)
 */
export function computeDaysElapsed(referenceDate: Date): number {
  const today = new Date();
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();

  const daysInMonth = new Date(refYear, refMonth + 1, 0).getDate();

  if (refYear === todayYear && refMonth === todayMonth) {
    return Math.max(1, today.getDate());
  }
  if (refYear < todayYear || (refYear === todayYear && refMonth < todayMonth)) {
    return daysInMonth;
  }
  return 1;
}

/** Aggregate transactions into one entry per day of the month */
export function buildDailyData(
  transactions: readonly Transaction[],
  currentDate: Date,
): DailyDataPoint[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const map: Record<string, DailyDataPoint> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const key = `${year}-${mm}-${dd}`;
    map[key] = { date: key, expense: 0, income: 0 };
  }

  for (const tx of transactions) {
    const key = tx.occurred_at.slice(0, 10);
    if (!map[key]) continue;
    const amount = Number(tx.amount);
    if (tx.type === "expense") map[key].expense += amount;
    else if (tx.type === "income") map[key].income += amount;
  }

  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Aggregate by category, sort descending.
 * @param palette Color array assigned by index (pass CATEGORY_COLORS from theme)
 */
export function buildCategoryStats(
  transactions: readonly Transaction[],
  type: "expense" | "income",
  categoryMap: Record<string, { id: string; name: string; icon: string }>,
  palette: readonly string[],
): CategoryStat[] {
  const map: Record<
    string,
    {
      categoryId: string | null;
      emoji: string;
      name: string;
      amount: number;
      count: number;
    }
  > = {};

  for (const tx of transactions) {
    if (tx.type !== type) continue;
    const cat = categoryMap[tx.category_id];
    const key = cat?.name ?? "其他";
    if (!map[key])
      map[key] = {
        categoryId: cat?.id ?? null,
        emoji: cat?.icon ?? "📦",
        name: key,
        amount: 0,
        count: 0,
      };
    map[key].amount += Number(tx.amount);
    map[key].count += 1;
  }

  const sorted = Object.values(map).sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((s, c) => s + c.amount, 0) || 1;

  return sorted.map((item, i) => ({
    ...item,
    percent: Math.round((item.amount / total) * 100),
    color: palette[i % palette.length],
  }));
}

/** Sort transactions by amount descending */
export function buildTransactionRank(
  transactions: readonly Transaction[],
  type: "expense" | "income",
  categoryMap: Record<string, { id: string; name: string; icon: string }>,
): RankedTransaction[] {
  return transactions
    .filter((tx) => tx.type === type)
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .map((tx) => {
      const cat = categoryMap[tx.category_id];
      return {
        id: tx.id,
        categoryEmoji: cat?.icon ?? "📦",
        categoryName: cat?.name ?? "其他",
        amount: Number(tx.amount),
        date: tx.occurred_at.slice(0, 10),
        ...(tx.note?.trim() ? { note: tx.note.trim() } : {}),
      };
    });
}

/** Extract dimension value from a DailyDataPoint */
export function getDimensionValue(
  point: DailyDataPoint,
  dimension: Dimension,
): number {
  if (dimension === "expense") return point.expense;
  if (dimension === "income") return point.income;
  return point.income - point.expense;
}

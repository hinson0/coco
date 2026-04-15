import type { Transaction, Category } from "@coco/shared";

export interface InsightContext {
  readonly currentMonth: readonly Transaction[];
  readonly previousMonth: readonly Transaction[];
  readonly categories: readonly Category[];
  readonly year: number;
  readonly month: number;
  readonly daysInMonth: number;
  readonly daysElapsed: number;
}

export type InsightType =
  | "health"
  | "category-change"
  | "anomaly"
  | "pace"
  | "frequency"
  | "saving";

export interface InsightBadge {
  readonly text: string;
  readonly direction: "up" | "down" | "neutral";
}

export interface InsightNavigation {
  readonly route: string;
  readonly params: Record<string, string>;
}

export interface CategoryChangeMeta {
  readonly categoryId: string;
  readonly currentAmount: number;
  readonly previousAmount: number;
  readonly changePercent: number;
}

export interface AnomalyMeta {
  readonly transactionId: string;
  readonly amount: number;
  readonly categoryEmoji: string;
  readonly categoryName: string;
  readonly date: string;
}

export interface PaceMeta {
  readonly timeProgress: number;
  readonly spendProgress: number;
  readonly estimatedMonthTotal: number;
}

export interface FrequencyMeta {
  readonly categoryId: string;
  readonly categoryEmoji: string;
  readonly categoryName: string;
  readonly count: number;
  readonly totalAmount: number;
}

export interface HealthScoreMeta {
  readonly score: number;
  readonly level: string;
  readonly savingsRate: number;
  readonly prevSavingsRate: number | undefined;
}

export interface SavingSuggestion {
  readonly category: string;
  readonly emoji: string;
  readonly reduceCount: number;
  readonly saveAmount: number;
}

export interface SavingMeta {
  readonly suggestions: readonly SavingSuggestion[];
  readonly totalSaving: number;
}

export type InsightMeta =
  | CategoryChangeMeta
  | AnomalyMeta
  | PaceMeta
  | FrequencyMeta
  | HealthScoreMeta
  | SavingMeta;

export interface InsightItem {
  readonly type: InsightType;
  readonly priority: number;
  readonly emoji: string;
  readonly title: string;
  readonly desc: string;
  readonly badge?: InsightBadge;
  readonly navigation?: InsightNavigation;
  readonly meta?: InsightMeta;
}

export type InsightRule = (
  ctx: InsightContext,
) => InsightItem | InsightItem[] | null;

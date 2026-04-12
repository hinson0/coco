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

export interface InsightItem {
  readonly type: InsightType;
  readonly priority: number;
  readonly emoji: string;
  readonly title: string;
  readonly desc: string;
  readonly badge?: InsightBadge;
  readonly navigation?: InsightNavigation;
  readonly meta?: Record<string, any>;
}

export type InsightRule = (
  ctx: InsightContext,
) => InsightItem | InsightItem[] | null;

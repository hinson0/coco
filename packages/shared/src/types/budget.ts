export type BudgetPeriod = "weekly" | "monthly" | "yearly";

export interface Budget {
  readonly id: string;
  readonly user_id: string;
  readonly category_id: string | null;
  readonly amount: number;
  readonly period: BudgetPeriod;
  readonly start_date: string;
}

export interface CreateBudgetInput {
  readonly category_id: string | null;
  readonly amount: number;
  readonly period: BudgetPeriod;
  readonly start_date: string;
}

export interface UpdateBudgetInput {
  readonly amount: number;
}

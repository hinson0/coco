export type TransactionType = "income" | "expense";

export interface Category {
  readonly id: string;
  readonly user_id: string | null;
  readonly name: string;
  readonly icon: string;
  readonly type: TransactionType;
  readonly is_default: boolean;
}

export interface CreateCategoryInput {
  readonly name: string;
  readonly icon: string;
  readonly type: TransactionType;
}

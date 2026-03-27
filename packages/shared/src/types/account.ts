// 资金账户类型定义，支持余额追踪的多账户管理
export type AccountType = "cash" | "bank" | "e_wallet" | "credit" | "custom";

export interface Account {
  readonly id: string;
  readonly user_id: string | null;
  readonly name: string;
  readonly icon: string;
  readonly type: AccountType;
  readonly initial_balance: number;
  readonly created_at: string;
  readonly deleted_at: string | null;
}

export interface CreateAccountInput {
  readonly name: string;
  readonly icon: string;
  readonly type: AccountType;
  readonly initial_balance: number;
}

export interface UpdateAccountInput {
  readonly name?: string;
  readonly icon?: string;
  readonly type?: AccountType;
  readonly initial_balance?: number;
}

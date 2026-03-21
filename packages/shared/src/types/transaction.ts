import type { TransactionType } from "./category";

export type RecordSource = "manual" | "rule" | "ocr" | "asr" | "text";

export interface Transaction {
  readonly id: string;
  readonly user_id: string;
  readonly category_id: string;
  readonly amount: number;
  readonly type: TransactionType;
  readonly note: string;
  readonly occurred_at: string;
  readonly source: RecordSource;
  readonly raw_input: string | null;
  readonly receipt_url: string | null;
  readonly ai_confidence: number | null;
  readonly created_at: string;
  readonly deleted_at: string | null;
}

export interface CreateTransactionInput {
  readonly category_id: string;
  readonly amount: number;
  readonly type: TransactionType;
  readonly note: string;
  readonly occurred_at: string;
  readonly source?: RecordSource;
  readonly raw_input?: string;
  readonly receipt_url?: string;
  readonly ai_confidence?: number;
  readonly skip_chat?: boolean;
}

export interface UpdateTransactionInput {
  readonly category_id?: string;
  readonly amount?: number;
  readonly type?: TransactionType;
  readonly note?: string;
  readonly occurred_at?: string;
}

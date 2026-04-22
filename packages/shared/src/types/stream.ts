import type { TransactionType } from "./category";

/**
 * SSE 流式话术事件 —— 后端 `/chat/stream` 和 `/record-ocr/stream` 端点的
 * 事件协议。后端 Pydantic schema 在 apps/backend/schemas/chat_stream.py,
 * 字段必须与此定义保持一致。
 */

export type StreamEventType =
  | "chunk"
  | "bill"
  | "text"
  | "asr"
  | "error";

export interface StreamTransaction {
  readonly amount: number;
  readonly category: string;
  readonly note: string;
  readonly occurred_at: string;
  readonly type: TransactionType;
}

export interface StreamChunkEvent {
  readonly type: "chunk";
  readonly text: string;
}

export interface StreamBillEvent {
  readonly type: "bill";
  readonly transaction: StreamTransaction;
  readonly asr_text?: string | null;
}

export interface StreamTextEvent {
  readonly type: "text";
  readonly content: string;
  readonly asr_text?: string | null;
}

export interface StreamAsrEvent {
  readonly type: "asr";
  readonly text: string;
}

export interface StreamErrorEvent {
  readonly type: "error";
  readonly message: string;
}

export type StreamEvent =
  | StreamChunkEvent
  | StreamBillEvent
  | StreamTextEvent
  | StreamAsrEvent
  | StreamErrorEvent;

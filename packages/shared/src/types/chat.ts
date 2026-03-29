export type ChatRole = "user" | "assistant";
export type ChatContentType = "text" | "audio" | "image" | "bill_card" | "nl_result";

export interface ChatMessage {
  readonly id: string;
  readonly user_id: string;
  readonly role: ChatRole;
  readonly content_type: ChatContentType;
  readonly content: string;
  readonly transaction_id: string | null;
  readonly created_at: string;
  readonly audio_uri?: string | null;
  readonly duration_seconds?: number | null;
}

export interface PendingMessage extends ChatMessage {
  readonly status: 'pending' | 'failed';
  readonly clientId: string;
}
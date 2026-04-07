// apps/mobile/hooks/useLocalChatMessages.ts
import { useOfflineContext } from "@/lib/offline-context";
import type { ChatContentType, ChatMessage, ChatRole } from "@coco/shared";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as Crypto from "expo-crypto";

export interface AddMessageInput {
  readonly role: ChatRole;
  readonly content_type: ChatContentType;
  readonly content: string;
  readonly transaction_id?: string | null;
  readonly audio_uri?: string | null;
  readonly duration_seconds?: number | null;
}

const CHAT_PAGE_SIZE = 30;

export function useLocalChatMessages(limit: number = CHAT_PAGE_SIZE) {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["chat-messages", limit],
    queryFn: async (): Promise<readonly ChatMessage[]> => {
      if (!db) return [];
      const rows = await db.getAllAsync<ChatMessage>(
        "SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT ?",
        limit,
      );
      return [...rows].reverse();
    },
    enabled: !!db,
    placeholderData: keepPreviousData,
  });
}

export function useAddChatMessage(options?: { skipInvalidate?: boolean }) {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddMessageInput): Promise<string> => {
      if (!db) throw new Error("Database not initialized");
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      await db.runAsync(
        "INSERT INTO chat_messages (id, user_id, role, content_type, content, transaction_id, created_at, audio_uri, duration_seconds) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)",
        id,
        input.role,
        input.content_type,
        input.content,
        input.transaction_id ?? null,
        now,
        input.audio_uri ?? null,
        input.duration_seconds ?? null,
      );
      return id;
    },
    onSuccess: () => {
      if (!options?.skipInvalidate) {
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
      }
    },
  });
}

export function useDeleteChatMessage() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!db) throw new Error("Database not initialized");
      await db.runAsync("DELETE FROM chat_messages WHERE id = ?", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
    },
  });
}

export function useClearChatMessages() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!db) throw new Error("Database not initialized");
      await db.runAsync("DELETE FROM chat_messages");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
    },
  });
}

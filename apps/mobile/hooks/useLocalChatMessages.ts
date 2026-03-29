// apps/mobile/hooks/useLocalChatMessages.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useOfflineContext } from "@/lib/offline-context";
import type { ChatMessage, ChatRole, ChatContentType } from "@coco/shared";

export interface AddMessageInput {
  readonly role: ChatRole;
  readonly content_type: ChatContentType;
  readonly content: string;
  readonly transaction_id?: string | null;
  readonly audio_uri?: string | null;
  readonly duration_seconds?: number | null;
}

export function useLocalChatMessages() {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["chat-messages"],
    queryFn: async (): Promise<readonly ChatMessage[]> => {
      if (!db) return [];
      return db.getAllAsync<ChatMessage>(
        "SELECT * FROM chat_messages ORDER BY created_at ASC"
      );
    },
    enabled: !!db,
  });
}

export function useAddChatMessage() {
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
        input.duration_seconds ?? null
      );
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
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

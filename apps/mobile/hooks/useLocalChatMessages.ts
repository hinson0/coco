// apps/mobile/hooks/useLocalChatMessages.ts
import { useOfflineContext } from "@/lib/offline-context";
import { QK } from "@/lib/queryKeys";
import { CHAT_INITIAL_LIMIT, fetchChatMessages } from "@/lib/db/queries";
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

export function useLocalChatMessages(limit: number = CHAT_INITIAL_LIMIT) {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: [QK.chatMessages, userId, limit],
    queryFn: async (): Promise<readonly ChatMessage[]> => {
      if (!db || !userId) return [];
      return fetchChatMessages(db, userId, limit);
    },
    enabled: !!db && !!userId,
    placeholderData: keepPreviousData,
  });
}

export function useAddChatMessage(options?: { skipInvalidate?: boolean }) {
  const { db, userId } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddMessageInput): Promise<string> => {
      if (!db || !userId) throw new Error("Database not initialized");
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      await db.runAsync(
        "INSERT INTO chat_messages (id, user_id, role, content_type, content, transaction_id, created_at, updated_at, audio_uri, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id,
        userId,
        input.role,
        input.content_type,
        input.content,
        input.transaction_id ?? null,
        now,
        now,
        input.audio_uri ?? null,
        input.duration_seconds ?? null,
      );
      return id;
    },
    onSuccess: () => {
      if (!options?.skipInvalidate) {
        qc.invalidateQueries({ queryKey: [QK.chatMessages] });
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
      const now = new Date().toISOString();
      await db.runAsync(
        "UPDATE chat_messages SET deleted_at = ?, updated_at = ? WHERE id = ?",
        now,
        now,
        id,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK.chatMessages] });
    },
  });
}

export function useClearChatMessages() {
  const { db, userId } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!db || !userId) throw new Error("Database not initialized");
      const now = new Date().toISOString();
      await db.runAsync(
        "UPDATE chat_messages SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND deleted_at IS NULL",
        now,
        now,
        userId,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK.chatMessages] });
    },
  });
}

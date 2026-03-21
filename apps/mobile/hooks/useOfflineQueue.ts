// apps/mobile/hooks/useOfflineQueue.ts
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import {
  enqueue,
  remove,
  findByTempId,
} from "@/lib/queue/operation-queue";
import { useOfflineContext } from "@/lib/offline-context";

interface EnqueueCreateParams {
  readonly amount: number;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly note: string;
  readonly type: "expense" | "income";
  readonly occurredAt: string;
  readonly source: "manual" | "rule";
}

interface EnqueueUpdateParams {
  readonly id: string;
  readonly amount?: number;
  readonly categoryId?: string;
  readonly note?: string;
  readonly type?: "expense" | "income";
  readonly occurredAt?: string;
}

export function useOfflineQueue() {
  const { db, syncManager } = useOfflineContext();
  const queryClient = useQueryClient();

  const enqueueCreate = useCallback(
    async (params: EnqueueCreateParams): Promise<string> => {
      if (!db) throw new Error("Database not initialized");

      const tempId = `temp_${Crypto.randomUUID()}`;

      await enqueue(db, {
        type: "create_transaction",
        payload: {
          amount: params.amount,
          category_id: params.categoryId,
          type: params.type,
          note: params.note,
          occurred_at: params.occurredAt,
          source: params.source,
          temp_id: tempId,
        },
      });

      // Optimistic update: insert temp transaction into React Query cache
      queryClient.setQueryData<any>(["transactions", 1], (old: any) => {
        if (!old) return old;
        const tempTransaction = {
          id: tempId,
          amount: params.amount,
          category_id: params.categoryId,
          type: params.type,
          note: params.note,
          occurred_at: params.occurredAt,
          source: params.source,
          created_at: new Date().toISOString(),
          deleted_at: null,
          raw_input: null,
          receipt_url: null,
          ai_confidence: null,
          user_id: "",
          category: { name: params.categoryName },
        };
        return {
          ...old,
          data: [tempTransaction, ...(old.data ?? [])],
        };
      });

      syncManager?.sync();
      return tempId;
    },
    [db, queryClient, syncManager]
  );

  const enqueueUpdate = useCallback(
    async (params: EnqueueUpdateParams): Promise<void> => {
      if (!db) throw new Error("Database not initialized");

      const payload: Record<string, unknown> = { id: params.id };
      if (params.amount !== undefined) payload.amount = params.amount;
      if (params.categoryId !== undefined)
        payload.category_id = params.categoryId;
      if (params.note !== undefined) payload.note = params.note;
      if (params.type !== undefined) payload.type = params.type;
      if (params.occurredAt !== undefined)
        payload.occurred_at = params.occurredAt;

      await enqueue(db, {
        type: "update_transaction",
        payload,
      });

      // Optimistic update
      queryClient.setQueryData<any>(["transactions", 1], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: (old.data ?? []).map((tx: any) =>
            tx.id === params.id ? { ...tx, ...payload } : tx
          ),
        };
      });

      syncManager?.sync();
    },
    [db, queryClient, syncManager]
  );

  const enqueueDelete = useCallback(
    async (transactionId: string): Promise<void> => {
      if (!db) throw new Error("Database not initialized");

      // Check if there's a pending create for this ID
      const pendingCreate = await findByTempId(db, transactionId);

      if (pendingCreate) {
        if (pendingCreate.status === "pending") {
          await remove(db, pendingCreate.id);
        } else {
          // status is 'syncing' — enqueue delete with dependency
          await enqueue(db, {
            type: "delete_transaction",
            payload: { id: transactionId },
            dependsOn: pendingCreate.id,
          });
        }
      } else {
        await enqueue(db, {
          type: "delete_transaction",
          payload: { id: transactionId },
        });
      }

      // Optimistic removal
      queryClient.setQueryData<any>(["transactions", 1], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: (old.data ?? []).filter((tx: any) => tx.id !== transactionId),
        };
      });

      syncManager?.sync();
    },
    [db, queryClient, syncManager]
  );

  return { enqueueCreate, enqueueUpdate, enqueueDelete };
}

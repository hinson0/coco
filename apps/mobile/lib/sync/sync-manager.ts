// apps/mobile/lib/sync/sync-manager.ts
import type * as SQLite from "expo-sqlite";
import {
  getPending,
  markSyncing,
  markPending,
  markFailed,
  markFailedByDependency,
  incrementRetry,
  remove,
  exists,
  updatePayload,
  getDependents,
  type QueueOperation,
} from "@/lib/queue/operation-queue";

interface SyncManagerConfig {
  readonly db: SQLite.SQLiteDatabase;
  readonly apiFetch: <T>(path: string, options?: RequestInit) => Promise<T>;
  readonly invalidateQueries: (keys: readonly string[]) => Promise<void>;
  readonly isOnline: () => boolean;
}

export interface SyncManager {
  sync(): Promise<void>;
}

const MAX_RETRIES = 3;

export function createSyncManager(config: SyncManagerConfig): SyncManager {
  const { db, apiFetch, invalidateQueries, isOnline } = config;
  let isSyncing = false;

  async function sync(): Promise<void> {
    if (isSyncing) return;
    if (!isOnline()) return;

    isSyncing = true;
    try {
      const operations = await getPending(db);

      for (const op of operations) {
        if (op.depends_on && (await exists(db, op.depends_on))) {
          continue;
        }

        await markSyncing(db, op.id);

        try {
          await executeOperation(op);
          await remove(db, op.id);
        } catch (error) {
          const isNetworkError =
            error instanceof TypeError ||
            (error instanceof Error && error.message.includes("network"));

          if (isNetworkError) {
            await markPending(db, op.id);
            break;
          }

          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          const nextRetries = op.retries + 1;
          if (nextRetries >= MAX_RETRIES) {
            await markFailed(db, op.id, errorMsg);
            await markFailedByDependency(db, op.id);
          } else {
            await incrementRetry(db, op.id, errorMsg);
          }
        }
      }

      await invalidateQueries(["transactions", "chat-messages"]);
    } finally {
      isSyncing = false;
    }
  }

  async function executeOperation(op: QueueOperation): Promise<void> {
    const payload = JSON.parse(op.payload);

    if (op.type === "create_transaction") {
      const response = await apiFetch<{
        success: boolean;
        data: { id: string };
      }>("/api/record/manual", {
        method: "POST",
        body: JSON.stringify({ ...payload, skip_chat: true }),
      });

      const dependents = await getDependents(db, op.id);
      for (const dep of dependents) {
        const depPayload = JSON.parse(dep.payload);
        await updatePayload(db, dep.id, {
          ...depPayload,
          id: response.data.id,
        });
      }
    }

    if (op.type === "update_transaction") {
      await apiFetch(`/api/transactions/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    }

    if (op.type === "delete_transaction") {
      await apiFetch(`/api/transactions/${payload.id}`, {
        method: "DELETE",
      });
    }
  }

  return { sync };
}

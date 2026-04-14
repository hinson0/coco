import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineContext } from "@/lib/offline-context";
import {
  getPendingList,
  confirmPending,
  dismissPending,
  getPendingCount,
} from "@/lib/auto-bookkeeping/pending-queue";
import type { PendingNotification } from "@/lib/auto-bookkeeping/pending-queue";

export const PENDING_QUERY_KEY = "pending-notifications";

export function usePendingNotifications() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: [PENDING_QUERY_KEY, userId],
    queryFn: async (): Promise<readonly PendingNotification[]> => {
      if (!db || !userId) return [];
      return getPendingList(db, userId);
    },
    enabled: !!db && !!userId,
  });
}

export function usePendingCount() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: [PENDING_QUERY_KEY, "count", userId],
    queryFn: async (): Promise<number> => {
      if (!db || !userId) return 0;
      return getPendingCount(db, userId);
    },
    enabled: !!db && !!userId,
  });
}

export function useConfirmPending() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pendingId,
      transactionId,
    }: {
      readonly pendingId: string;
      readonly transactionId: string;
    }) => {
      if (!db) throw new Error("Database not initialized");
      await confirmPending(db, pendingId, transactionId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PENDING_QUERY_KEY] });
    },
  });
}

export function useDismissPending() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (pendingId: string) => {
      if (!db) throw new Error("Database not initialized");
      await dismissPending(db, pendingId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PENDING_QUERY_KEY] });
    },
  });
}

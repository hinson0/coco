import { useQuery } from "@tanstack/react-query";
import { useOfflineContext } from "@/lib/offline-context";
import type { TransactionType } from "@coco/shared";

export function useRecentCategory(type: TransactionType) {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["recent-category", type, userId],
    queryFn: async (): Promise<string | null> => {
      if (!db || !userId) return null;

      const row = await db.getFirstAsync<{ category_id: string }>(
        `SELECT category_id FROM transactions
         WHERE user_id = ? AND type = ? AND deleted_at IS NULL
         ORDER BY occurred_at DESC LIMIT 1`,
        userId,
        type,
      );
      if (row) return row.category_id;

      const fallback = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM categories
         WHERE (user_id = ? OR user_id IS NULL) AND type = ? AND deleted_at IS NULL
         ORDER BY is_default DESC LIMIT 1`,
        userId,
        type,
      );
      return fallback?.id ?? null;
    },
    enabled: !!db && !!userId,
  });
}

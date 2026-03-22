// apps/mobile/hooks/useLocalCategories.ts
import { useQuery } from "@tanstack/react-query";
import { useOfflineContext } from "@/lib/offline-context";
import type { Category } from "@coco/shared";

export function useLocalCategories() {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<readonly Category[]> => {
      if (!db) return [];
      const rows = await db.getAllAsync<Category>(
        "SELECT * FROM categories ORDER BY type, name"
      );
      return rows.map((r) => ({ ...r, is_default: Boolean(r.is_default) }));
    },
    enabled: !!db,
  });
}

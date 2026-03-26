// 分类数据的本地 CRUD hook（查询、新增、编辑、软删除）
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useOfflineContext } from "@/lib/offline-context";
import type { Category, CreateCategoryInput } from "@coco/shared";

export function useLocalCategories() {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<readonly Category[]> => {
      if (!db) return [];
      const rows = await db.getAllAsync<Category>(
        "SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY type, name"
      );
      return rows.map((r) => ({ ...r, is_default: Boolean(r.is_default) }));
    },
    enabled: !!db,
  });
}

export function useCreateCategory() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      if (!db) throw new Error("Database not initialized");
      const id = Crypto.randomUUID();
      await db.runAsync(
        "INSERT INTO categories (id, user_id, name, icon, type, is_default) VALUES (?, NULL, ?, ?, ?, 0)",
        id,
        input.name,
        input.icon,
        input.type
      );
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useUpdateCategory() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { readonly id: string; readonly name: string; readonly icon: string }) => {
      if (!db) throw new Error("Database not initialized");
      await db.runAsync(
        "UPDATE categories SET name = ?, icon = ? WHERE id = ?",
        params.name,
        params.icon,
        params.id
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useDeleteCategory() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!db) throw new Error("Database not initialized");
      await db.runAsync(
        "UPDATE categories SET deleted_at = ? WHERE id = ? AND is_default = 0",
        new Date().toISOString(),
        id
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

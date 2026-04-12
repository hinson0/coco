// 分类数据的本地 CRUD hook（查询、新增、编辑、软删除）
import { useOfflineContext } from "@/lib/offline-context";
import type { Category, CreateCategoryInput } from "@coco/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";

export function useLocalCategories() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["categories", userId],
    queryFn: async (): Promise<readonly Category[]> => {
      // db 或 userId 不存在时返回空数组
      /**
       * 那就存在一种可能性,当用户登录时就应该有user id啊
       */
      if (!db || !userId) return [];

      //
      const rows = await db.getAllAsync<Category>(
        "SELECT * FROM categories WHERE deleted_at IS NULL AND (user_id = ? OR (user_id IS NULL AND is_default = 1)) ORDER BY type, name",
        userId,
      );
      return rows.map((r) => ({ ...r, is_default: Boolean(r.is_default) }));
    },
    enabled: !!db && !!userId, // 只有 db 和 userId 都就绪时才执行查询，避免无效请求
  });
}

export function useCreateCategory() {
  const { db, userId } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      if (!db || !userId) throw new Error("Database not initialized");
      const id = Crypto.randomUUID();
      await db.runAsync(
        "INSERT INTO categories (id, user_id, name, icon, type, is_default, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
        id,
        userId,
        input.name,
        input.icon,
        input.type,
        new Date().toISOString(),
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
    mutationFn: async (params: {
      readonly id: string;
      readonly name: string;
      readonly icon: string;
    }) => {
      if (!db) throw new Error("Database not initialized");
      await db.runAsync(
        "UPDATE categories SET name = ?, icon = ?, updated_at = ? WHERE id = ?",
        params.name,
        params.icon,
        new Date().toISOString(),
        params.id,
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
        "UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ? AND is_default = 0",
        new Date().toISOString(),
        new Date().toISOString(),
        id,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

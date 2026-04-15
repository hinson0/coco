// apps/mobile/hooks/useLocalBudgets.ts
import { useOfflineContext } from "@/lib/offline-context";
import { QK } from "@/lib/queryKeys";
import type {
  Budget,
  CreateBudgetInput,
  UpdateBudgetInput,
} from "@coco/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";

export function useLocalBudgets() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: [QK.budgets, userId],
    queryFn: async (): Promise<readonly Budget[]> => {
      if (!db || !userId) return [];
      return db.getAllAsync<Budget>(
        "SELECT * FROM budgets WHERE user_id = ? AND deleted_at IS NULL ORDER BY start_date DESC",
        userId,
      );
    },
    enabled: !!db && !!userId,
  });
}

export function useCreateBudget() {
  const { db, userId } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBudgetInput) => {
      if (!db || !userId) throw new Error("Database not initialized");
      const id = Crypto.randomUUID();
      await db.runAsync(
        "INSERT INTO budgets (id, user_id, category_id, amount, period, start_date, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        id,
        userId,
        input.category_id,
        input.amount,
        input.period,
        input.start_date,
        new Date().toISOString(),
      );
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK.budgets] });
    },
  });
}

export function useUpdateBudget() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateBudgetInput & { readonly id: string }) => {
      if (!db) throw new Error("Database not initialized");
      await db.runAsync(
        "UPDATE budgets SET amount = ?, updated_at = ? WHERE id = ?",
        params.amount,
        new Date().toISOString(),
        params.id,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK.budgets] });
    },
  });
}

export function useDeleteBudget() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!db) throw new Error("Database not initialized");
      const now = new Date().toISOString();
      await db.runAsync(
        "UPDATE budgets SET deleted_at = ?, updated_at = ? WHERE id = ?",
        now,
        now,
        id,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK.budgets] });
    },
  });
}

export function useGlobalBudget() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: [QK.budgets, "global", userId],
    queryFn: async (): Promise<Budget | null> => {
      if (!db || !userId) return null;
      return db.getFirstAsync<Budget>(
        "SELECT * FROM budgets WHERE user_id = ? AND category_id IS NULL AND period = 'monthly' AND deleted_at IS NULL ORDER BY start_date DESC LIMIT 1",
        userId,
      );
    },
    enabled: !!db && !!userId,
  });
}

export function useCategoryBudgets() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: [QK.budgets, "category", userId],
    queryFn: async (): Promise<readonly Budget[]> => {
      if (!db || !userId) return [];
      return db.getAllAsync<Budget>(
        `SELECT * FROM budgets 
        WHERE user_id = ? 
        AND category_id IS NOT NULL 
        AND deleted_at IS NULL 
        AND period = 'monthly' 
        ORDER BY start_date DESC`,
        userId,
      );
    },
    enabled: !!db && !!userId,
  });
}

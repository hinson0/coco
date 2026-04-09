// apps/mobile/hooks/useLocalBudgets.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useOfflineContext } from "@/lib/offline-context";
import type { Budget, CreateBudgetInput, UpdateBudgetInput } from "@coco/shared";

export function useLocalBudgets() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["budgets", userId],
    queryFn: async (): Promise<readonly Budget[]> => {
      if (!db || !userId) return [];
      return db.getAllAsync<Budget>("SELECT * FROM budgets WHERE user_id = ? ORDER BY start_date DESC", userId);
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
        "INSERT INTO budgets (id, user_id, category_id, amount, period, start_date) VALUES (?, ?, ?, ?, ?, ?)",
        id,
        userId,
        input.category_id,
        input.amount,
        input.period,
        input.start_date
      );
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
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
        "UPDATE budgets SET amount = ? WHERE id = ?",
        params.amount,
        params.id
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useDeleteBudget() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!db) throw new Error("Database not initialized");
      await db.runAsync("DELETE FROM budgets WHERE id = ?", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useGlobalBudget() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["budgets", "global", userId],
    queryFn: async (): Promise<Budget | null> => {
      if (!db || !userId) return null;
      return db.getFirstAsync<Budget>(
        "SELECT * FROM budgets WHERE user_id = ? AND category_id IS NULL AND period = 'monthly' ORDER BY start_date DESC LIMIT 1",
        userId
      );
    },
    enabled: !!db && !!userId,
  });
}

export function useCategoryBudgets() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["budgets", "category", userId],
    queryFn: async (): Promise<readonly Budget[]> => {
      if (!db || !userId) return [];
      return db.getAllAsync<Budget>(
        "SELECT * FROM budgets WHERE user_id = ? AND category_id IS NOT NULL AND period = 'monthly' ORDER BY start_date DESC",
        userId
      );
    },
    enabled: !!db && !!userId,
  });
}

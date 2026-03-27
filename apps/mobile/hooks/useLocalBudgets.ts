// apps/mobile/hooks/useLocalBudgets.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useOfflineContext } from "@/lib/offline-context";
import type { Budget, CreateBudgetInput, UpdateBudgetInput } from "@coco/shared";

export function useLocalBudgets() {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["budgets"],
    queryFn: async (): Promise<readonly Budget[]> => {
      if (!db) return [];
      return db.getAllAsync<Budget>("SELECT * FROM budgets ORDER BY start_date DESC");
    },
    enabled: !!db,
  });
}

export function useCreateBudget() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBudgetInput) => {
      if (!db) throw new Error("Database not initialized");
      const id = Crypto.randomUUID();
      await db.runAsync(
        "INSERT INTO budgets (id, user_id, category_id, amount, period, start_date) VALUES (?, NULL, ?, ?, ?, ?)",
        id,
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
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["budgets", "global"],
    queryFn: async (): Promise<Budget | null> => {
      if (!db) return null;
      return db.getFirstAsync<Budget>(
        "SELECT * FROM budgets WHERE category_id IS NULL AND period = 'monthly' ORDER BY start_date DESC LIMIT 1"
      );
    },
    enabled: !!db,
  });
}

export function useCategoryBudgets() {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["budgets", "category"],
    queryFn: async (): Promise<readonly Budget[]> => {
      if (!db) return [];
      return db.getAllAsync<Budget>(
        "SELECT * FROM budgets WHERE category_id IS NOT NULL AND period = 'monthly' ORDER BY start_date DESC"
      );
    },
    enabled: !!db,
  });
}

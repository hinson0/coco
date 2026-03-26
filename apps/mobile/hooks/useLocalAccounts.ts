// apps/mobile/hooks/useLocalAccounts.ts
// Account CRUD + 余额计算 hook
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useOfflineContext } from "@/lib/offline-context";
import type { Account, CreateAccountInput, UpdateAccountInput } from "@coco/shared";

export function useAccounts() {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["accounts"],
    queryFn: async (): Promise<readonly Account[]> => {
      if (!db) return [];
      const rows = await db.getAllAsync<Account>(
        "SELECT * FROM accounts WHERE deleted_at IS NULL ORDER BY created_at ASC"
      );
      return rows.map((r) => ({ ...r, is_default: Boolean(r.is_default) }));
    },
    enabled: !!db,
  });
}

export function useAccountBalance(accountId: string | undefined) {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["account-balance", accountId],
    queryFn: async (): Promise<number> => {
      if (!db || !accountId) return 0;

      const account = await db.getFirstAsync<Account>(
        "SELECT * FROM accounts WHERE id = ?",
        accountId
      );
      if (!account) return 0;

      const income = await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = 'income' AND deleted_at IS NULL",
        accountId
      );
      const expense = await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = 'expense' AND deleted_at IS NULL",
        accountId
      );
      return account.initial_balance + (income?.total ?? 0) - (expense?.total ?? 0);
    },
    enabled: !!db && !!accountId,
  });
}

export function useTotalAssets() {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ["total-assets"],
    queryFn: async (): Promise<number> => {
      if (!db) return 0;

      const accounts = await db.getAllAsync<Account>(
        "SELECT * FROM accounts WHERE deleted_at IS NULL"
      );

      let total = 0;
      for (const account of accounts) {
        const income = await db.getFirstAsync<{ total: number }>(
          "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = 'income' AND deleted_at IS NULL",
          account.id
        );
        const expense = await db.getFirstAsync<{ total: number }>(
          "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = 'expense' AND deleted_at IS NULL",
          account.id
        );
        total += account.initial_balance + (income?.total ?? 0) - (expense?.total ?? 0);
      }
      return total;
    },
    enabled: !!db,
  });
}

export function useCreateAccount() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAccountInput) => {
      if (!db) throw new Error("Database not initialized");
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      await db.runAsync(
        "INSERT INTO accounts (id, user_id, name, icon, type, initial_balance, is_default, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)",
        id,
        input.name,
        input.icon,
        input.type,
        input.initial_balance,
        input.is_default ? 1 : 0,
        now
      );
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["total-assets"] });
    },
  });
}

export function useUpdateAccount() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateAccountInput & { readonly id: string }) => {
      if (!db) throw new Error("Database not initialized");
      const fields: string[] = [];
      const values: (string | number)[] = [];
      if (params.name !== undefined) { fields.push("name = ?"); values.push(params.name); }
      if (params.icon !== undefined) { fields.push("icon = ?"); values.push(params.icon); }
      if (params.type !== undefined) { fields.push("type = ?"); values.push(params.type); }
      if (params.initial_balance !== undefined) { fields.push("initial_balance = ?"); values.push(params.initial_balance); }
      if (fields.length === 0) return;
      values.push(params.id);
      await db.runAsync(
        `UPDATE accounts SET ${fields.join(", ")} WHERE id = ?`,
        ...values
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["account-balance"] });
      qc.invalidateQueries({ queryKey: ["total-assets"] });
    },
  });
}

export function useDeleteAccount() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!db) throw new Error("Database not initialized");
      await db.runAsync(
        "UPDATE accounts SET deleted_at = ? WHERE id = ?",
        new Date().toISOString(),
        id
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["total-assets"] });
    },
  });
}

// apps/mobile/hooks/useLocalTransactions.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useOfflineContext } from "@/lib/offline-context";
import type { Transaction, CreateTransactionInput, UpdateTransactionInput } from "@coco/shared";

export function useLocalTransactions(page = 1, limit = 20) {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["transactions", page, userId],
    queryFn: async () => {
      if (!db || !userId) return { data: [] as Transaction[], total: 0, page, limit };
      const offset = (page - 1) * limit;
      const [rows, countRow] = await Promise.all([
        db.getAllAsync<Transaction>(
          "SELECT * FROM transactions WHERE user_id = ? AND deleted_at IS NULL ORDER BY occurred_at DESC LIMIT ? OFFSET ?",
          userId,
          limit,
          offset
        ),
        db.getFirstAsync<{ count: number }>(
          "SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND deleted_at IS NULL",
          userId
        ),
      ]);
      return { data: rows, total: countRow?.count ?? 0, page, limit };
    },
    enabled: !!db && !!userId,
  });
}

export function useMonthlyTransactions(year: number, month: number, accountId?: string | null) {
  const { db, userId } = useOfflineContext();

  const startDate = new Date(year, month, 1).toISOString();
  const endDate = new Date(year, month + 1, 1).toISOString();

  return useQuery({
    queryKey: ["transactions", "monthly", `${year}-${String(month + 1).padStart(2, "0")}`, accountId ?? "all", userId],
    queryFn: async (): Promise<readonly Transaction[]> => {
      if (!db || !userId) return [];
      if (accountId) {
        return db.getAllAsync<Transaction>(
          "SELECT * FROM transactions WHERE user_id = ? AND deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ? AND account_id = ? ORDER BY occurred_at DESC",
          userId,
          startDate,
          endDate,
          accountId
        );
      }
      return db.getAllAsync<Transaction>(
        "SELECT * FROM transactions WHERE user_id = ? AND deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ? ORDER BY occurred_at DESC",
        userId,
        startDate,
        endDate
      );
    },
    enabled: !!db && !!userId,
  });
}

export function useCreateTransaction() {
  const { db, userId } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTransactionInput): Promise<string> => {
      if (!db || !userId) throw new Error("Database not initialized");
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO transactions (id, user_id, category_id, amount, type, note, occurred_at, source, raw_input, receipt_url, ai_confidence, created_at, updated_at, account_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        userId,
        input.category_id,
        input.amount,
        input.type,
        input.note,
        input.occurred_at,
        input.source ?? "manual",
        input.raw_input ?? null,
        input.receipt_url ?? null,
        input.ai_confidence ?? null,
        now,
        now,
        input.account_id ?? null
      );
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["account-balance"] });
      qc.invalidateQueries({ queryKey: ["total-assets"] });
    },
  });
}

export function useUpdateTransaction() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateTransactionInput & { readonly id: string }) => {
      if (!db) throw new Error("Database not initialized");
      const fields: string[] = [];
      const values: (string | number)[] = [];
      if (params.category_id !== undefined) { fields.push("category_id = ?"); values.push(params.category_id); }
      if (params.amount !== undefined) { fields.push("amount = ?"); values.push(params.amount); }
      if (params.type !== undefined) { fields.push("type = ?"); values.push(params.type); }
      if (params.note !== undefined) { fields.push("note = ?"); values.push(params.note); }
      if (params.occurred_at !== undefined) { fields.push("occurred_at = ?"); values.push(params.occurred_at); }
      if (params.account_id !== undefined) { fields.push("account_id = ?"); values.push(params.account_id as any); }
      fields.push("updated_at = ?");
      values.push(new Date().toISOString());
      if (fields.length === 0) return;
      values.push(params.id);
      await db.runAsync(
        `UPDATE transactions SET ${fields.join(", ")} WHERE id = ?`,
        ...values
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["account-balance"] });
      qc.invalidateQueries({ queryKey: ["total-assets"] });
    },
  });
}

export function useDeleteTransaction() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!db) throw new Error("Database not initialized");
      await db.runAsync(
        "UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ?",
        new Date().toISOString(),
        new Date().toISOString(),
        id
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["account-balance"] });
      qc.invalidateQueries({ queryKey: ["total-assets"] });
    },
  });
}

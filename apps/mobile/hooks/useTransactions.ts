import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type { PaginatedResponse, Transaction } from "@coco/shared";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";

export function useTransactions(page = 1) {
  return useQuery({
    queryKey: ["transactions", page],
    queryFn: () => apiFetch<PaginatedResponse<Transaction>>(`/api/transactions?page=${page}&limit=20`),
  });
}

export function useDeleteTransaction() {
  const { enqueueDelete } = useOfflineQueue();
  return useMutation({
    mutationFn: (id: string) => enqueueDelete(id),
  });
}

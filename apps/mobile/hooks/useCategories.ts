import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type { ApiResponse, Category } from "@coco/shared";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<ApiResponse<Category[]>>("/api/categories"),
  });
}

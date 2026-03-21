import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../lib/api";
import type { ApiResponse, ChatMessage, PaginatedResponse } from "@coco/shared";

type ChatInfiniteData = InfiniteData<PaginatedResponse<ChatMessage>>;

export function useDeleteChatMessage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiResponse<null>>(`/api/chat/messages/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["chat-messages"] });
      const previous = qc.getQueryData<ChatInfiniteData>(["chat-messages"]);

      qc.setQueryData<ChatInfiniteData>(["chat-messages"], (old) => {
        if (!old) return old;
        let found = false;
        const newPages = old.pages.map((page) => {
          const filtered = page.data.filter((msg) => msg.id !== id);
          if (filtered.length < page.data.length) found = true;
          return { ...page, data: filtered };
        });
        if (!found) return old;
        return {
          ...old,
          pages: newPages.map((p) => ({ ...p, total: p.total - 1 })),
        };
      });

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(["chat-messages"], context.previous);
      }
      Alert.alert("删除失败", "请稍后重试");
    },
  });
}

export function useClearChatMessages() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<ApiResponse<null>>("/api/chat/messages", { method: "DELETE" }),
    onSuccess: async () => {
      qc.setQueryData<ChatInfiniteData>(["chat-messages"], {
        pages: [{ success: true, data: [], total: 0, page: 1, limit: 30 }],
        pageParams: [1],
      });
      await AsyncStorage.removeItem("REACT_QUERY_OFFLINE_CACHE");
    },
    onError: () => {
      Alert.alert("清空失败", "请稍后重试");
    },
  });
}

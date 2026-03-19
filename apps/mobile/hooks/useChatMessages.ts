import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { ChatMessage, PaginatedResponse } from '@coco/shared';

const PAGE_SIZE = 30;

export function useChatMessages() {
  return useInfiniteQuery({
    queryKey: ['chat-messages'],
    queryFn: ({ pageParam = 1 }) =>
      apiFetch<PaginatedResponse<ChatMessage>>(
        `/api/chat/messages?page=${pageParam}&limit=${PAGE_SIZE}`,
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.limit;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });
}

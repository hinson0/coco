import { useCallback } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { apiFetch } from '../lib/api';
import { useChatStore } from '../store/chatStore';
import type {
  ChatMessage,
  PendingMessage,
  PaginatedResponse,
} from '@coco/shared';

type ChatInfiniteData = InfiniteData<PaginatedResponse<ChatMessage>>;

function createPendingMessage(
  overrides: Pick<ChatMessage, 'content_type' | 'content'>,
): PendingMessage {
  const clientId = randomUUID();
  return {
    id: clientId,
    user_id: '',
    role: 'user',
    content_type: overrides.content_type,
    content: overrides.content,
    transaction_id: null,
    created_at: new Date().toISOString(),
    status: 'pending',
    clientId,
  };
}

function insertMessagesIntoCache(
  qc: ReturnType<typeof useQueryClient>,
  userMsg: ChatMessage,
  assistantMsg: ChatMessage,
) {
  qc.setQueryData<ChatInfiniteData>(['chat-messages'], (old) => {
    if (!old) return old;
    const firstPage = old.pages[0];
    if (!firstPage) return old;
    return {
      ...old,
      pages: [
        {
          ...firstPage,
          data: [assistantMsg, userMsg, ...firstPage.data],
          total: firstPage.total + 2,
        },
        ...old.pages.slice(1).map((p) => ({ ...p, total: p.total + 2 })),
      ],
    };
  });
}

export function useChat() {
  const { addPending, removePending, markFailed, setLoading } = useChatStore();
  const qc = useQueryClient();

  const sendText = useCallback(
    async (text: string) => {
      const pending = createPendingMessage({
        content_type: 'text',
        content: text,
      });
      addPending(pending);
      setLoading(true);

      try {
        const resp = await apiFetch<any>('/api/record/text', {
          method: 'POST',
          body: JSON.stringify({ text }),
        });
        let assistantMsg: ChatMessage;
        if (resp.data?.type === 'bill') {
          assistantMsg = {
            id: resp.data.transaction.id,
            user_id: '',
            role: 'assistant',
            content_type: 'bill_card',
            content: JSON.stringify(resp.data.transaction),
            transaction_id: resp.data.transaction.id,
            created_at: new Date().toISOString(),
          };
          qc.invalidateQueries({ queryKey: ['transactions'] });
        } else if (resp.data?.type === 'nl_result') {
          assistantMsg = {
            id: `asst-${Date.now()}`,
            user_id: '',
            role: 'assistant',
            content_type: 'nl_result',
            content: resp.data.message,
            transaction_id: null,
            created_at: new Date().toISOString(),
          };
        } else {
          assistantMsg = {
            id: `asst-${Date.now()}`,
            user_id: '',
            role: 'assistant',
            content_type: 'text',
            content: resp.data?.message ?? '处理完成',
            transaction_id: null,
            created_at: new Date().toISOString(),
          };
        }

        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          user_id: '',
          role: 'user',
          content_type: 'text',
          content: text,
          transaction_id: null,
          created_at: pending.created_at,
        };
        insertMessagesIntoCache(qc, userMsg, assistantMsg);
        removePending(pending.clientId);
      } catch {
        markFailed(pending.clientId);
      } finally {
        setLoading(false);
      }
    },
    [addPending, removePending, markFailed, setLoading, qc],
  );

  const sendOcr = useCallback(
    async (imageBase64: string) => {
      const pending = createPendingMessage({
        content_type: 'image',
        content: '[拍照]',
      });
      addPending(pending);
      setLoading(true);
      try {
        const resp = await apiFetch<any>('/api/record/ocr', {
          method: 'POST',
          body: JSON.stringify({ imageBase64 }),
        });
        let assistantMsg: ChatMessage;
        if (resp.data?.type === 'bill') {
          assistantMsg = {
            id: resp.data.transaction.id,
            user_id: '',
            role: 'assistant',
            content_type: 'bill_card',
            content: JSON.stringify(resp.data.transaction),
            transaction_id: resp.data.transaction.id,
            created_at: new Date().toISOString(),
          };
          qc.invalidateQueries({ queryKey: ['transactions'] });
        } else {
          assistantMsg = {
            id: `asst-${Date.now()}`,
            user_id: '',
            role: 'assistant',
            content_type: 'text',
            content: resp.data?.message ?? '小票识别失败,请手动记账.',
            transaction_id: null,
            created_at: new Date().toISOString(),
          };
        }
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          user_id: '',
          role: 'user',
          content_type: 'image',
          content: '[拍照]',
          transaction_id: null,
          created_at: pending.created_at,
        };
        insertMessagesIntoCache(qc, userMsg, assistantMsg);
        removePending(pending.clientId);
      } catch {
        markFailed(pending.clientId);
      } finally {
        setLoading(false);
      }
    },
    [addPending, removePending, markFailed, setLoading, qc],
  );

  const sendAsr = useCallback(
    async (audioBase64: string) => {
      const pending = createPendingMessage({
        content_type: 'audio',
        content: '[语音]',
      });
      addPending(pending);
      setLoading(true);
      try {
        const resp = await apiFetch<any>('/api/record/asr', {
          method: 'POST',
          body: JSON.stringify({ audioBase64 }),
        });
        let assistantMsg: ChatMessage;
        if (resp.data?.type === 'bill') {
          assistantMsg = {
            id: resp.data.transaction.id,
            user_id: '',
            role: 'assistant',
            content_type: 'bill_card',
            content: JSON.stringify(resp.data.transaction),
            transaction_id: resp.data.transaction.id,
            created_at: new Date().toISOString(),
          };
          qc.invalidateQueries({ queryKey: ['transactions'] });
        } else {
          assistantMsg = {
            id: `asst-${Date.now()}`,
            user_id: '',
            role: 'assistant',
            content_type: 'text',
            content: resp.data?.message ?? '没听清，要不再说一次？',
            transaction_id: null,
            created_at: new Date().toISOString(),
          };
        }
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          user_id: '',
          role: 'user',
          content_type: 'audio',
          content: '[语音]',
          transaction_id: null,
          created_at: pending.created_at,
        };
        insertMessagesIntoCache(qc, userMsg, assistantMsg);
        removePending(pending.clientId);
      } catch {
        markFailed(pending.clientId);
      } finally {
        setLoading(false);
      }
    },
    [addPending, removePending, markFailed, setLoading, qc],
  );

  return { sendText, sendOcr, sendAsr };
}

import { create } from 'zustand';
import type { PendingMessage } from '@coco/shared';

interface ChatState {
  readonly pendingMessages: readonly PendingMessage[];
  readonly isLoading: boolean;
  addPending: (msg: PendingMessage) => void;
  removePending: (clientId: string) => void;
  markFailed: (clientId: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  pendingMessages: [],
  isLoading: false,
  addPending: (msg) =>
    set((s) => ({ pendingMessages: [...s.pendingMessages, msg] })),
  removePending: (clientId) =>
    set((s) => ({
      pendingMessages: s.pendingMessages.filter((m) => m.clientId !== clientId),
    })),
  markFailed: (clientId) =>
    set((s) => ({
      pendingMessages: s.pendingMessages.map((m) =>
        m.clientId === clientId ? { ...m, status: 'failed' as const } : m,
      ),
    })),
  setLoading: (isLoading) => set({ isLoading }),
}));

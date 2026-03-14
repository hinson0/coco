import { create } from "zustand";
import type { ChatMessage } from "@coco/shared";

interface ChatState {
  readonly messages: readonly ChatMessage[];
  readonly isLoading: boolean;
  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: readonly ChatMessage[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (messages) => set({ messages }),
  setLoading: (isLoading) => set({ isLoading }),
}));

import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePendingNotifications,
  useConfirmPending,
  useDismissPending,
  PENDING_QUERY_KEY,
} from "../../hooks/usePendingNotifications";
import { useCreateTransaction } from "../../hooks/useLocalTransactions";
import { useAddChatMessage } from "../../hooks/useLocalChatMessages";
import { useOfflineContext } from "@/lib/offline-context";
import { ConfirmSheet } from "./ConfirmSheet";
import type { PendingNotification } from "../../lib/auto-bookkeeping/pending-queue";

export function PendingConfirmOverlay() {
  const { data: pendingList = [] } = usePendingNotifications();
  const qc = useQueryClient();
  const { userId } = useOfflineContext();
  const createTransaction = useCreateTransaction();
  const confirmMutation = useConfirmPending();
  const dismissMutation = useDismissPending();
  const addMessage = useAddChatMessage();

  // 乐观更新：从 React Query 缓存中移除已处理的 pending 项
  // 防止 showNext() 后 stale 数据触发重复弹窗
  const removePendingFromCache = useCallback(
    (pendingId: string) => {
      if (!userId) return;
      qc.setQueryData(
        [PENDING_QUERY_KEY, userId],
        (old: readonly PendingNotification[] | undefined) =>
          old?.filter((p) => p.id !== pendingId) ?? [],
      );
    },
    [qc, userId],
  );

  const [visible, setVisible] = useState(false);
  const [currentPending, setCurrentPending] =
    useState<PendingNotification | null>(null);

  useEffect(() => {
    if (!visible && pendingList.length > 0 && !currentPending) {
      setCurrentPending(pendingList[0]);
      setVisible(true);
    }
  }, [pendingList, visible, currentPending]);

  // App 从后台恢复时检查队列
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && !visible && pendingList.length > 0) {
        setCurrentPending(pendingList[0]);
        setVisible(true);
      }
    });
    return () => subscription.remove();
  }, [visible, pendingList]);

  const showNext = useCallback(() => {
    setVisible(false);
    setCurrentPending(null);
    // 延迟后让 pendingList 刷新，下一条会通过 useEffect 自动弹出
  }, []);

  const handleConfirm = useCallback(
    async (categoryId: string, note: string) => {
      if (!currentPending) return;

      const txId = await createTransaction.mutateAsync({
        category_id: categoryId,
        amount: currentPending.amount,
        type: currentPending.type,
        note,
        occurred_at: new Date(
          currentPending.notification_timestamp,
        ).toISOString(),
        source: "notification",
        raw_input: currentPending.raw_text ?? undefined,
      });

      await confirmMutation.mutateAsync({
        pendingId: currentPending.id,
        transactionId: txId,
      });

      const sourceLabel =
        currentPending.source === "wechat" ? "微信支付" : "支付宝";
      addMessage.mutate({
        role: "assistant",
        content_type: "bill_card",
        content: JSON.stringify({
          id: txId,
          amount: currentPending.amount,
          type: currentPending.type,
          category_id: categoryId,
          note,
          source: sourceLabel,
          occurred_at: new Date(
            currentPending.notification_timestamp,
          ).toISOString(),
        }),
        transaction_id: txId,
      });

      removePendingFromCache(currentPending.id);
      showNext();
    },
    [
      currentPending,
      createTransaction,
      confirmMutation,
      addMessage,
      removePendingFromCache,
      showNext,
    ],
  );

  const handleDismiss = useCallback(async () => {
    if (currentPending) {
      await dismissMutation.mutateAsync(currentPending.id);
      removePendingFromCache(currentPending.id);
    }
    showNext();
  }, [currentPending, dismissMutation, removePendingFromCache, showNext]);

  return (
    <ConfirmSheet
      visible={visible}
      pending={currentPending}
      onConfirm={handleConfirm}
      onDismiss={handleDismiss}
    />
  );
}

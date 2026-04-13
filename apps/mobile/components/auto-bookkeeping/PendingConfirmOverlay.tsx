import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import {
  usePendingNotifications,
  useConfirmPending,
  useDismissPending,
} from "../../hooks/usePendingNotifications";
import { useCreateTransaction } from "../../hooks/useLocalTransactions";
import { useAddChatMessage } from "../../hooks/useLocalChatMessages";
import { ConfirmSheet } from "./ConfirmSheet";
import type { PendingNotification } from "../../lib/auto-bookkeeping/pending-queue";

export function PendingConfirmOverlay() {
  const { data: pendingList = [] } = usePendingNotifications();
  const createTransaction = useCreateTransaction();
  const confirmMutation = useConfirmPending();
  const dismissMutation = useDismissPending();
  const addMessage = useAddChatMessage();

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
          amount: currentPending.amount,
          type: currentPending.type,
          category_id: categoryId,
          note,
          source: sourceLabel,
        }),
        transaction_id: txId,
      });

      showNext();
    },
    [currentPending, createTransaction, confirmMutation, addMessage, showNext],
  );

  const handleDismiss = useCallback(async () => {
    if (currentPending) {
      await dismissMutation.mutateAsync(currentPending.id);
    }
    showNext();
  }, [currentPending, dismissMutation, showNext]);

  return (
    <ConfirmSheet
      visible={visible}
      pending={currentPending}
      onConfirm={handleConfirm}
      onDismiss={handleDismiss}
    />
  );
}

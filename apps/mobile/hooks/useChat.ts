import {
  useAddChatMessage,
  useDeleteChatMessage,
} from "@/hooks/useLocalChatMessages";
import { useCreateTransaction } from "@/hooks/useLocalTransactions";
import { useOfflineContext } from "@/lib/offline-context";
import { QK } from "@/lib/queryKeys";
import { openStream, type StreamEvent } from "@/lib/sse";
import type { Category } from "@coco/shared";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useState } from "react";

const CONNECTION_ABORTED_MSG = "连接异常，以上内容已保存，可以再试一次~";

export function useChat() {
  const { db, userId } = useOfflineContext();
  const qc = useQueryClient();
  const { mutateAsync: addMessage } = useAddChatMessage({
    skipInvalidate: true,
  });
  const { mutateAsync: createTransaction } = useCreateTransaction();
  const { mutateAsync: deleteMessage } = useDeleteChatMessage();
  const [isLoading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);

  const resolveCategoryId = useCallback(
    (categoryName: string, txType: "expense" | "income") => {
      const list = qc.getQueryData<readonly Category[]>([
        QK.categories,
        userId,
      ]);
      const otherName = txType === "income" ? "其他收入" : "其他支出";
      const matched = categoryName
        ? list?.find((c) => c.name === categoryName && c.type === txType)
        : undefined;
      return (matched ?? list?.find((c) => c.name === otherName))?.id ?? "";
    },
    [qc, userId],
  );

  const runStream = useCallback(
    async (
      path: string,
      body: object,
      options?: {
        source: "llm" | "asr" | "ocr";
        onAsrText?: (text: string) => Promise<void> | void;
      },
    ): Promise<{
      hadBill: boolean;
      hadError: boolean;
      hadServerText: boolean;
    }> => {
      const source = options?.source ?? "llm";
      setLoading(true);
      setStreamingText("");

      // 闭包局部变量：每次 runStream 独立，天然防止并发调用互相覆盖累积缓冲。
      let accumulated = "";
      let unhandledError: string | null = null;
      let hadBill = false;
      let hadServerText = false;

      const flushAccumulatedAsText = async () => {
        if (!accumulated) return;
        const content = accumulated;
        accumulated = "";
        await addMessage({
          role: "assistant",
          content_type: "text",
          content,
        });
      };

      try {
        await new Promise<void>((resolve) => {
          openStream(path, body, {
            onEvent: async (event: StreamEvent) => {
              if (event.type === "chunk") {
                accumulated += event.text;
                setStreamingText(accumulated);
                return;
              }
              if (event.type === "asr") {
                await options?.onAsrText?.(event.text);
                return;
              }
              if (event.type === "bill") {
                hadBill = true;
                const tx = event.transaction;
                const occurredAt = tx.occurred_at || new Date().toISOString();
                const categoryId = resolveCategoryId(tx.category, tx.type);
                // 把累积的流式文字落成独立 text 消息；不动 streamingText
                // 这个 React state——StreamingBubble 由 buildListItems 通过
                // 「内容匹配」自然隐藏，避免 streaming 消失→真实消息出现的空白帧。
                await flushAccumulatedAsText();
                const txId = await createTransaction({
                  amount: tx.amount,
                  category_id: categoryId,
                  type: tx.type,
                  note: tx.note,
                  occurred_at: occurredAt,
                  source,
                });
                await addMessage({
                  role: "assistant",
                  content_type: "bill_card",
                  content: JSON.stringify({
                    id: txId,
                    amount: tx.amount,
                    type: tx.type,
                    note: tx.note,
                    category_id: categoryId,
                    occurred_at: occurredAt,
                    source,
                  }),
                  transaction_id: txId,
                });
                qc.invalidateQueries({ queryKey: [QK.transactions] });
                // 立刻刷新 chatMessages，让真实 text + bill_card 尽快进入
                // messages 数组，使 buildListItems 在下一帧完成接棒。
                qc.invalidateQueries({ queryKey: [QK.chatMessages] });
                return;
              }
              if (event.type === "text") {
                // 服务端终态文本（query 结果 / 错误兜底等），与累积流式合并
                // 落成一条消息；仍不动 streamingText，靠 buildListItems 接棒。
                const combined =
                  accumulated && event.content
                    ? `${accumulated}\n${event.content}`
                    : accumulated || event.content;
                accumulated = "";
                if (combined) {
                  hadServerText = true;
                  await addMessage({
                    role: "assistant",
                    content_type: "text",
                    content: combined,
                  });
                  qc.invalidateQueries({ queryKey: [QK.chatMessages] });
                }
                return;
              }
              if (event.type === "error") {
                unhandledError = event.message;
              }
            },
            onDone: () => resolve(),
            onError: (msg) => {
              unhandledError = msg;
              resolve();
            },
          }).catch((err) => {
            console.error("[useChat] openStream threw:", err);
            unhandledError = "连接失败，请稍后再试。";
            resolve();
          });
        });

        // 流正常结束：闲聊分支只发 chunk 不发终态 text 事件，这里把残余
        // chunk 作为 assistant text 消息入库；同样不动 streamingText，
        // 由 buildListItems 的内容匹配完成接棒。
        if (!unhandledError && accumulated) {
          await flushAccumulatedAsText();
          qc.invalidateQueries({ queryKey: [QK.chatMessages] });
        }

        if (unhandledError) {
          // 断连保留已流出的内容 + 追加一条"连接异常"提示。
          await flushAccumulatedAsText();
          await addMessage({
            role: "assistant",
            content_type: "text",
            content: CONNECTION_ABORTED_MSG,
          });
        }
      } finally {
        setLoading(false);
        // 先 await invalidate 让 SQLite refetch 完成、真实消息进入 messages,
        // 再清 streamingText。否则 StreamingBubble 瞬间消失时 bill_card/text
        // 还没落到 messages 里, user 消息会短暂从视觉中间下沉到底部再闪回
        // 上方 —— 正是用户感知到的"消息闪一下"bug。
        await qc.invalidateQueries({ queryKey: [QK.chatMessages] });
        setStreamingText(null);
      }
      return { hadBill, hadError: !!unhandledError, hadServerText };
    },
    [addMessage, createTransaction, qc, resolveCategoryId],
  );

  const sendText = useCallback(
    async (text: string) => {
      if (!db) return;
      await addMessage({ role: "user", content_type: "text", content: text });
      qc.invalidateQueries({ queryKey: [QK.chatMessages] });
      await runStream("/chat/stream", { text }, { source: "llm" });
    },
    [db, qc, addMessage, runStream],
  );

  const sendOcr = useCallback(
    async (imageBase64: string, onFail?: (imageMessageId: string) => void) => {
      if (!db) return;
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "拍照记账需要联网才能使用，请连接网络后重试。",
        });
        qc.invalidateQueries({ queryKey: [QK.chatMessages] });
        return;
      }

      let imageContent = "[拍照]";
      try {
        const dir = `${FileSystem.documentDirectory}ocr-images/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const filePath = `${dir}${Date.now()}-${Crypto.randomUUID()}.jpg`;
        await FileSystem.writeAsStringAsync(filePath, imageBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        imageContent = filePath;
      } catch (err) {
        console.error("[sendOcr] 图片保存失败:", err);
      }

      const imageMessageId = await addMessage({
        role: "user",
        content_type: "image",
        content: imageContent,
      });
      qc.invalidateQueries({ queryKey: [QK.chatMessages] });

      const hintMessageId = await addMessage({
        role: "assistant",
        content_type: "text",
        content: "小票拍到了，正在识别...",
      });
      qc.invalidateQueries({ queryKey: [QK.chatMessages] });

      const { hadBill, hadServerText } = await runStream(
        "/record-ocr/stream",
        { imageBase64 },
        { source: "ocr" },
      );

      if (!hadBill) {
        // 识别失败：移除"正在识别"提示。若服务端已经下发了具体的失败文案
        // （hadServerText），就不再触发 onFail 的通用重试 hint,避免出现
        // 两条语义重复的失败提示。
        try {
          await deleteMessage(hintMessageId);
        } catch (err) {
          console.error("[sendOcr] 清理提示消息失败:", err);
        }
        if (!hadServerText) {
          onFail?.(imageMessageId);
        }
      }
    },
    [db, qc, addMessage, deleteMessage, runStream],
  );

  const sendAsr = useCallback(
    async (audioBase64: string, durationSeconds: number) => {
      if (!db) return;

      let audioUri: string | null = null;
      try {
        const dir = `${FileSystem.documentDirectory}voice-messages/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        audioUri = `${dir}${Date.now()}-${Crypto.randomUUID()}.m4a`;
        await FileSystem.writeAsStringAsync(audioUri, audioBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (err) {
        console.error("[sendAsr] 音频保存失败:", err);
      }

      const msgId = await addMessage({
        role: "user",
        content_type: "audio",
        content: "[语音]",
        audio_uri: audioUri,
        duration_seconds: durationSeconds,
      });
      qc.invalidateQueries({ queryKey: [QK.chatMessages] });

      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "未联网，无法使用语音服务。",
        });
        qc.invalidateQueries({ queryKey: [QK.chatMessages] });
        return;
      }

      await runStream(
        "/chat/stream",
        { audioBase64 },
        {
          source: "asr",
          onAsrText: async (asrText: string) => {
            await db.runAsync(
              "UPDATE chat_messages SET content = ? WHERE id = ?",
              asrText,
              msgId,
            );
          },
        },
      );
    },
    [db, qc, addMessage, runStream],
  );

  return {
    sendText,
    sendOcr,
    sendAsr,
    isLoading,
    streamingText,
  };
}

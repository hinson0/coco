import { useAddChatMessage } from "@/hooks/useLocalChatMessages";
import { useCreateTransaction } from "@/hooks/useLocalTransactions";
import { useOfflineContext } from "@/lib/offline-context";
import type { Category } from "@coco/shared";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useState } from "react";
import { apiFetch } from "../lib/api";

type ChatBillData = {
  type: "bill";
  asrText?: string;
  transaction: {
    amount: number;
    category: string;
    note: string;
    occurred_at: string;
    type: "expense" | "income";
  };
};

type ChatTextData = {
  type: "text";
  asrText?: string;
  content: string;
};

type ChatNlData = {
  type: "nl_result";
  asrText?: string;
  content: string;
};

type ChatErrorData = {
  type: "error";
  message: string;
};

type ChatResponse = {
  data: ChatBillData | ChatTextData | ChatNlData;
};

type OcrResponse = {
  data: ChatBillData | ChatErrorData;
};

export function useChat() {
  const { db, userId } = useOfflineContext();
  const qc = useQueryClient();
  const { mutateAsync: addMessage } = useAddChatMessage({
    skipInvalidate: true,
  });
  const { mutateAsync: createTransaction } = useCreateTransaction();
  const [isLoading, setLoading] = useState(false);

  // ─── 核心处理逻辑：直接调 /chat ───
  // sendText 共享此逻辑
  const processText = useCallback(
    async (text: string) => {
      console.log("[processText] 输入:", text);
      setLoading(true);

      try {
        const resp = await apiFetch<ChatResponse>("/chat", {
          method: "POST",
          body: JSON.stringify({ text }),
        });

        console.log("[processText] /chat 返回:", JSON.stringify(resp.data));

        if (resp.data.type === "bill") {
          const tx = resp.data.transaction;
          const categoriesData = qc.getQueryData<readonly Category[]>([
            "categories",
            userId,
          ]);
          const otherName = tx.type === "income" ? "其他收入" : "其他支出";
          const category =
            (tx.category
              ? categoriesData?.find(
                  (c) => c.name === tx.category && c.type === tx.type,
                )
              : null) ?? categoriesData?.find((c) => c.name === otherName);

          const occurredAt = tx.occurred_at || new Date().toISOString();
          const txId = await createTransaction({
            amount: tx.amount,
            category_id: category?.id ?? "",
            type: tx.type,
            note: tx.note,
            occurred_at: occurredAt,
            source: "llm",
          });

          await addMessage({
            role: "assistant",
            content_type: "bill_card",
            content: JSON.stringify({
              id: txId,
              amount: tx.amount,
              type: tx.type,
              note: tx.note,
              category_id: category?.id ?? "",
              occurred_at: occurredAt,
            }),
            transaction_id: txId,
          });
          qc.invalidateQueries({ queryKey: ["transactions"] });
        } else {
          await addMessage({
            role: "assistant",
            content_type: "text",
            content: resp.data.content,
          });
        }
      } catch (err) {
        console.error("[processText] /chat 异常:", err);
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "处理失败，请稍后再试。",
        });
      } finally {
        setLoading(false);
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
      }
    },
    [qc, addMessage, createTransaction, db],
  );

  const sendText = useCallback(
    async (text: string) => {
      if (!db) return;
      console.log("[sendText] 文字输入:", text);
      await addMessage({ role: "user", content_type: "text", content: text });
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
      try {
        await processText(text);
      } catch (err) {
        console.error("[sendText] ❌ processText 异常:", err);
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "网络错误，请重试。",
        });
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
      }
    },
    [db, qc, addMessage, processText],
  );

  const sendOcr = useCallback(
    async (imageBase64: string, onFail?: (imageMessageId: string) => void) => {
      if (!db) return;
      console.log("[sendOcr] 拍照记账");
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        console.log("[sendOcr] ❌ 离线");
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "拍照记账需要联网才能使用，请连接网络后重试。",
        });
        return;
      }
      // 保存图片到本地文件系统
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
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
      console.log("[sendOcr] → 调用 /record-ocr");
      setLoading(true);
      try {
        const resp = await apiFetch<OcrResponse>("/record-ocr", {
          method: "POST",
          body: JSON.stringify({ imageBase64 }),
        });
        console.log("[sendOcr] OCR 返回:", JSON.stringify(resp.data));
        if (resp.data?.type === "bill") {
          const tx = resp.data.transaction;
          const categoriesData = qc.getQueryData<readonly Category[]>([
            "categories",
            userId,
          ]);
          const otherName = tx.type === "income" ? "其他收入" : "其他支出";
          const category =
            (tx.category
              ? categoriesData?.find(
                  (c) => c.name === tx.category && c.type === tx.type,
                )
              : null) ?? categoriesData?.find((c) => c.name === otherName);
          const txId = await createTransaction({
            amount: tx.amount,
            category_id: category?.id ?? "",
            type: tx.type,
            note: tx.note ?? "",
            occurred_at: tx.occurred_at ?? new Date().toISOString(),
            source: "ocr",
          });
          console.log(
            "[sendOcr] ✅ OCR 记账 → 分类:",
            category?.name,
            "| 金额:",
            tx.amount,
          );
          await addMessage({
            role: "assistant",
            content_type: "bill_card",
            content: JSON.stringify({
              id: txId,
              amount: tx.amount,
              type: tx.type,
              note: tx.note ?? "",
              category_id: category?.id,
              occurred_at: tx.occurred_at ?? new Date().toISOString(),
            }),
            transaction_id: txId,
          });
          qc.invalidateQueries({ queryKey: ["transactions"] });
        } else {
          // error
          console.log("[sendOcr] ⚠️ OCR 失败:", resp.data?.message);
          await addMessage({
            role: "assistant",
            content_type: "text",
            content: resp.data?.message ?? "小票识别失败，请手动记账。",
          });
          onFail?.(imageMessageId);
        }
      } catch (err) {
        console.error("[sendOcr] ❌ OCR 异常:", err);
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "网络错误，OCR 识别失败。",
        });
        onFail?.(imageMessageId);
      } finally {
        setLoading(false);
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
      }
    },
    [db, qc, addMessage, createTransaction],
  );

  const sendAsr = useCallback(
    async (audioBase64: string, durationSeconds: number) => {
      if (!db) return;

      // 1. 保存音频文件到本地
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

      // 2. 乐观渲染：立即显示语音气泡
      const msgId = await addMessage({
        role: "user",
        content_type: "audio",
        content: "[语音]",
        audio_uri: audioUri,
        duration_seconds: durationSeconds,
      });
      qc.invalidateQueries({ queryKey: ["chat-messages"] });

      // 3. 检查网络
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "未联网，无法使用语音服务。",
        });
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
        return;
      }

      // 4. 调用 /chat（后端做 ASR + classify_intent）
      console.log("[sendAsr] → 调用 /chat (语音)");
      setLoading(true);

      try {
        const resp = await apiFetch<ChatResponse>("/chat", {
          method: "POST",
          body: JSON.stringify({ audioBase64 }),
        });

        console.log("[sendAsr] /chat 返回:", JSON.stringify(resp.data));

        // 更新语音气泡的转写文字
        const asrText = resp.data.asrText;
        if (asrText) {
          await db.runAsync(
            "UPDATE chat_messages SET content = ? WHERE id = ?",
            asrText,
            msgId,
          );
        }

        if (resp.data.type === "bill") {
          const tx = resp.data.transaction;
          const categoriesData = qc.getQueryData<readonly Category[]>([
            "categories",
            userId,
          ]);
          const otherName = tx.type === "income" ? "其他收入" : "其他支出";
          const category =
            (tx.category
              ? categoriesData?.find(
                  (c) => c.name === tx.category && c.type === tx.type,
                )
              : null) ?? categoriesData?.find((c) => c.name === otherName);

          const occurredAt = tx.occurred_at || new Date().toISOString();
          const txId = await createTransaction({
            amount: tx.amount,
            category_id: category?.id ?? "",
            type: tx.type,
            note: tx.note,
            occurred_at: occurredAt,
            source: "asr",
          });

          await addMessage({
            role: "assistant",
            content_type: "bill_card",
            content: JSON.stringify({
              id: txId,
              amount: tx.amount,
              type: tx.type,
              note: tx.note,
              category_id: category?.id ?? "",
              occurred_at: occurredAt,
            }),
            transaction_id: txId,
          });
          qc.invalidateQueries({ queryKey: ["transactions"] });
        } else {
          await addMessage({
            role: "assistant",
            content_type: "text",
            content: resp.data.content,
          });
        }
      } catch (err) {
        console.error("[sendAsr] ❌ 异常:", err);
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "没听清，要不再说一次？",
        });
      } finally {
        setLoading(false);
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
      }
    },
    [db, qc, addMessage, createTransaction],
  );

  return { sendText, sendOcr, sendAsr, isLoading };
}

1; // apps/mobile/hooks/useChat.ts
import { useAddChatMessage } from "@/hooks/useLocalChatMessages";
import { useCreateTransaction } from "@/hooks/useLocalTransactions";
import { useOfflineContext } from "@/lib/offline-context";
import type { Category } from "@coco/shared";
import { parse } from "@coco/shared";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useState } from "react";
import { apiFetch } from "../lib/api";

export function useChat() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();
  const { mutateAsync: addMessage } = useAddChatMessage();
  const { mutateAsync: createTransaction } = useCreateTransaction();
  const [isLoading, setLoading] = useState(false);

  // ─── 核心处理逻辑：规则引擎 → 提示手动记账 ───
  // sendText 和 sendAsr 共享此逻辑
  const processText = useCallback(
    async (text: string) => {
      console.log("[processText] 输入:", text);

      // 1. 先尝试规则引擎
      const ruleResult = parse(text);
      console.log(
        "[processText] 规则引擎结果:",
        ruleResult ? JSON.stringify(ruleResult) : "未命中",
      );

      if (ruleResult) {
        const categoriesData = qc.getQueryData<readonly Category[]>([
          "categories",
        ]);
        const otherName =
          ruleResult.type === "expense" ? "其他支出" : "其他收入";
        const category =
          (ruleResult.categoryName
            ? categoriesData?.find(
                (c) =>
                  c.name === ruleResult.categoryName &&
                  c.type === ruleResult.type,
              )
            : null) ?? categoriesData?.find((c) => c.name === otherName);

        if (category) {
          const occurredAt = new Date().toISOString();
          console.log(
            "[processText] ✅ 规则引擎命中 → 分类:",
            category.name,
            "| 金额:",
            ruleResult.amount,
            "| note:",
            ruleResult.note,
          );
          const txId = await createTransaction({
            amount: ruleResult.amount,
            category_id: category.id,
            type: ruleResult.type,
            note: ruleResult.note,
            occurred_at: occurredAt,
            source: "rule",
          });
          await addMessage({
            role: "assistant",
            content_type: "bill_card",
            content: JSON.stringify({
              id: txId,
              amount: ruleResult.amount,
              type: ruleResult.type,
              note: ruleResult.note,
              category_id: category.id,
              occurred_at: occurredAt,
            }),
            transaction_id: txId,
          });
          return;
        }
        console.log("[processText] 规则引擎有结果但未匹配分类，提示手动记账");
      }

      // 2. 规则引擎未命中 → 提示手动记账
      console.log("[processText] ⚠️ 规则引擎未命中，提示手动记账");
      await addMessage({
        role: "assistant",
        content_type: "text",
        content: "没识别到记账信息，可以试试「手动记账」。",
      });
    },
    [qc, addMessage, createTransaction],
  );

  const sendText = useCallback(
    async (text: string) => {
      if (!db) return;
      console.log("[sendText] 文字输入:", text);
      await addMessage({ role: "user", content_type: "text", content: text });
      try {
        await processText(text);
      } catch (err) {
        console.error("[sendText] ❌ processText 异常:", err);
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "网络错误，请重试。",
        });
      }
    },
    [db, addMessage, processText],
  );

  const sendOcr = useCallback(
    async (
      imageBase64: string,
      onFail?: (imageMessageId: string) => void,
      onOcrText?: (merchant: string | null) => void,
    ) => {
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
      // 保存图片到本地文件系统，fallback 到占位符
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
      console.log("[sendOcr] → 调用 /record-ocr");
      setLoading(true);
      try {
        const resp = await apiFetch<any>("/record-ocr", {
          method: "POST",
          body: JSON.stringify({ imageBase64 }),
        });
        console.log("[sendOcr] OCR 返回:", JSON.stringify(resp.data));
        if (resp.data?.type === "bill") {
          const tx = resp.data.transaction;
          const categoriesData = qc.getQueryData<readonly Category[]>([
            "categories",
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
            "| note:",
            tx.note,
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
        } else if (resp.data?.type === "ocr_text") {
          // 识别到文字但正则提取不到金额 → 提示 + 触发导航回调
          console.log(
            "[sendOcr] ℹ️ OCR 有文字但无金额，merchant:",
            resp.data.merchant,
          );
          await addMessage({
            role: "assistant",
            content_type: "text",
            content: resp.data.merchant
              ? `已识别商户「${resp.data.merchant}」，请手动补充金额完成记账。`
              : "已识别小票内容，请手动补充金额完成记账。",
          });
          onOcrText?.(resp.data.merchant ?? null);
        } else {
          console.log("[sendOcr] ⚠️ OCR 未识别:", resp.data?.message);
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

      // 3. 检查网络
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "未联网，无法使用语音服务。",
        });
        return;
      }

      // 4. 调用 ASR API（纯语音转文字）
      console.log("[sendAsr] → 调用 /record-asr");
      try {
        const resp = await apiFetch<any>("/record-asr", {
          method: "POST",
          body: JSON.stringify({ audioBase64 }),
        });

        const asrText = resp.data?.asrText;
        console.log("[sendAsr] ASR 返回:", asrText || "(空)");
        if (!asrText) {
          console.log("[sendAsr] ⚠️ ASR 无文字");
          await addMessage({
            role: "assistant",
            content_type: "text",
            content: "没听清，要不再说一次？",
          });
          return;
        }

        // 5. 更新语音消息的 transcription
        await db.runAsync(
          "UPDATE chat_messages SET content = ? WHERE id = ?",
          asrText,
          msgId,
        );
        qc.invalidateQueries({ queryKey: ["chat-messages"] });

        // 6. 复用文字处理逻辑：规则引擎 → 提示手动记账
        console.log("[sendAsr] → 进入 processText:", asrText);
        await processText(asrText);
      } catch (err) {
        console.error("[sendAsr] ❌ 异常:", err);
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: "没听清，要不再说一次？",
        });
      }
    },
    [db, qc, addMessage, processText],
  );

  return { sendText, sendOcr, sendAsr, isLoading };
}

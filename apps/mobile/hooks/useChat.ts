// apps/mobile/hooks/useChat.ts
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { apiFetch } from "../lib/api";
import { parse } from "@/lib/rule-engine";
import { useOfflineContext } from "@/lib/offline-context";
import { useAddChatMessage } from "@/hooks/useLocalChatMessages";
import { useCreateTransaction } from "@/hooks/useLocalTransactions";
import type { Category } from "@coco/shared";

export function useChat() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();
  const { mutateAsync: addMessage } = useAddChatMessage();
  const { mutateAsync: createTransaction } = useCreateTransaction();
  const [isLoading, setLoading] = useState(false);

  const sendText = useCallback(async (text: string) => {
    if (!db) return;

    await addMessage({ role: "user", content_type: "text", content: text });

    // 1. 先尝试规则引擎
    const ruleResult = parse(text);

    if (ruleResult) {
      const categoriesData = qc.getQueryData<readonly Category[]>(["categories"]);
      const otherName = ruleResult.type === "expense" ? "其他支出" : "其他收入";
      const category = (ruleResult.categoryName
        ? categoriesData?.find(
            (c) => c.name === ruleResult.categoryName && c.type === ruleResult.type
          )
        : null
      ) ?? categoriesData?.find((c) => c.name === otherName);

      if (category) {
        const txId = await createTransaction({
          amount: ruleResult.amount,
          category_id: category.id,
          type: ruleResult.type,
          note: ruleResult.note,
          occurred_at: new Date().toISOString(),
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
            occurred_at: new Date().toISOString(),
          }),
          transaction_id: txId,
        });
        return;
      }
    }

    // 2. 规则未命中 → 检查网络
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      await addMessage({
        role: "assistant",
        content_type: "text",
        content: "当前离线，无法识别这条记录。请使用手动记账填写金额和分类。",
      });
      return;
    }

    // 3. 在线 → 走 BFF/GLM 流程
    setLoading(true);
    try {
      const resp = await apiFetch<any>("/record-text", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      if (resp.data?.type === "bill") {
        const tx = resp.data.transaction;
        await addMessage({
          role: "assistant",
          content_type: "bill_card",
          content: JSON.stringify(tx),
          transaction_id: tx.id,
        });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else if (resp.data?.type === "nl_result") {
        await addMessage({
          role: "assistant",
          content_type: "nl_result",
          content: resp.data.message,
        });
      } else {
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: resp.data?.message ?? "处理完成",
        });
      }
    } catch {
      await addMessage({
        role: "assistant",
        content_type: "text",
        content: "网络错误，请重试。",
      });
    } finally {
      setLoading(false);
    }
  }, [db, qc, addMessage, createTransaction]);

  const sendOcr = useCallback(async (imageBase64: string) => {
    if (!db) return;
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      await addMessage({ role: "assistant", content_type: "text", content: "拍照记账需要联网才能使用，请连接网络后重试。" });
      return;
    }
    // 保存图片到本地文件系统，fallback 到占位符
    let imageContent = "[拍照]";
    try {
      const dir = `${FileSystem.documentDirectory}ocr-images/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const filePath = `${dir}${Date.now()}-${Crypto.randomUUID()}.jpg`;
      await FileSystem.writeAsStringAsync(filePath, imageBase64, { encoding: FileSystem.EncodingType.Base64 });
      imageContent = filePath;
    } catch (err) {
      console.error('[sendOcr] 图片保存失败:', err);
    }
    await addMessage({ role: "user", content_type: "image", content: imageContent });
    setLoading(true);
    try {
      const resp = await apiFetch<any>("/record-ocr", { method: "POST", body: JSON.stringify({ imageBase64 }) });
      if (resp.data?.type === "bill") {
        const tx = resp.data.transaction;
        await addMessage({ role: "assistant", content_type: "bill_card", content: JSON.stringify(tx), transaction_id: tx.id });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        await addMessage({ role: "assistant", content_type: "text", content: resp.data?.message ?? "小票识别失败，请手动记账。" });
      }
    } catch {
      await addMessage({ role: "assistant", content_type: "text", content: "网络错误，OCR 识别失败。" });
    } finally {
      setLoading(false);
    }
  }, [db, qc, addMessage]);

  const sendAsr = useCallback(async (audioBase64: string, durationSeconds: number) => {
    if (!db) return;

    // 1. 保存音频文件到本地
    let audioUri: string | null = null;
    try {
      const dir = `${FileSystem.documentDirectory}voice-messages/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      audioUri = `${dir}${Date.now()}-${Crypto.randomUUID()}.m4a`;
      await FileSystem.writeAsStringAsync(audioUri, audioBase64, { encoding: FileSystem.EncodingType.Base64 });
    } catch (err) {
      console.error('[sendAsr] 音频保存失败:', err);
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

    // 4. 调用 ASR API
    setLoading(true);
    try {
      const resp = await apiFetch<any>("/record-asr", {
        method: "POST",
        body: JSON.stringify({ audioBase64 }),
      });

      // 5. 更新语音消息的 transcription
      if (resp.data?.asrText) {
        await db.runAsync(
          "UPDATE chat_messages SET content = ? WHERE id = ?",
          resp.data.asrText,
          msgId,
        );
        qc.invalidateQueries({ queryKey: ["chat-messages"] });
      }

      // 6. 处理响应
      if (resp.data?.type === "bill") {
        const tx = resp.data.transaction;
        await addMessage({
          role: "assistant",
          content_type: "bill_card",
          content: JSON.stringify(tx),
          transaction_id: tx.id,
        });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        await addMessage({
          role: "assistant",
          content_type: "text",
          content: resp.data?.message ?? "没听清，要不再说一次？",
        });
      }
    } catch {
      await addMessage({
        role: "assistant",
        content_type: "text",
        content: "网络错误，语音识别失败。",
      });
    } finally {
      setLoading(false);
    }
  }, [db, qc, addMessage]);

  return { sendText, sendOcr, sendAsr, isLoading };
}

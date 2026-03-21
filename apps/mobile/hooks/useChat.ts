import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { apiFetch } from "../lib/api";
import { useChatStore } from "../store/chatStore";
import { parse } from "@/lib/rule-engine";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import type { Category } from "@coco/shared";

export function useChat() {
  const { addMessage, setLoading } = useChatStore();
  const qc = useQueryClient();
  const { enqueueCreate } = useOfflineQueue();

  const sendText = useCallback(async (text: string) => {
    addMessage({ id: Date.now().toString(), user_id: "", role: "user", content_type: "text", content: text, transaction_id: null, created_at: new Date().toISOString() });

    // 1. 先尝试规则引擎
    const ruleResult = parse(text);

    if (ruleResult) {
      const categories = qc.getQueryData<{ data: Category[] }>(["categories"]);
      const otherName = ruleResult.type === "expense" ? "其他支出" : "其他收入";
      const category = (ruleResult.categoryName
        ? categories?.data?.find(
            (c) => c.name === ruleResult.categoryName && c.type === ruleResult.type
          )
        : null
      ) ?? categories?.data?.find((c) => c.name === otherName);

      if (category) {
        const tempId = await enqueueCreate({
          amount: ruleResult.amount,
          categoryId: category.id,
          categoryName: category.name,
          note: ruleResult.note,
          type: ruleResult.type,
          occurredAt: new Date().toISOString(),
          source: "rule",
        });
        addMessage({ id: `${Date.now()}-bill`, user_id: "", role: "assistant", content_type: "bill_card", content: JSON.stringify({ id: tempId, amount: ruleResult.amount, type: ruleResult.type, note: ruleResult.note, category: { name: category.name } }), transaction_id: tempId, created_at: new Date().toISOString() });
        return;
      }
    }

    // 2. 规则未命中 → 检查网络
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "text", content: "当前离线，无法识别这条记录。请使用手动记账填写金额和分类。", transaction_id: null, created_at: new Date().toISOString() });
      return;
    }

    // 3. 在线 → 走原有 BFF/GLM 流程
    setLoading(true);
    try {
      const resp = await apiFetch<any>("/api/record/text", { method: "POST", body: JSON.stringify({ text }) });
      if (resp.data?.type === "bill") {
        addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "bill_card", content: JSON.stringify(resp.data.transaction), transaction_id: resp.data.transaction.id, created_at: new Date().toISOString() });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else if (resp.data?.type === "nl_result") {
        addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "nl_result", content: resp.data.message, transaction_id: null, created_at: new Date().toISOString() });
      } else {
        addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "text", content: resp.data?.message ?? "处理完成", transaction_id: null, created_at: new Date().toISOString() });
      }
    } catch {
      addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "text", content: "网络错误，请重试。", transaction_id: null, created_at: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  }, [addMessage, setLoading, qc, enqueueCreate]);

  const sendOcr = useCallback(async (imageBase64: string) => {
    addMessage({ id: Date.now().toString(), user_id: "", role: "user", content_type: "image", content: "[拍照]", transaction_id: null, created_at: new Date().toISOString() });
    setLoading(true);
    try {
      const resp = await apiFetch<any>("/api/record/ocr", { method: "POST", body: JSON.stringify({ imageBase64 }) });
      if (resp.data?.type === "bill") {
        addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "bill_card", content: JSON.stringify(resp.data.transaction), transaction_id: resp.data.transaction.id, created_at: new Date().toISOString() });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "text", content: resp.data?.message ?? "小票识别失败，请手动记账。", transaction_id: null, created_at: new Date().toISOString() });
      }
    } catch {
      addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "text", content: "网络错误，OCR 识别失败。", transaction_id: null, created_at: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  }, [addMessage, setLoading, qc]);

  const sendAsr = useCallback(async (audioBase64: string) => {
    addMessage({ id: Date.now().toString(), user_id: "", role: "user", content_type: "audio", content: "[语音]", transaction_id: null, created_at: new Date().toISOString() });
    setLoading(true);
    try {
      const resp = await apiFetch<any>("/api/record/asr", { method: "POST", body: JSON.stringify({ audioBase64 }) });
      if (resp.data?.type === "bill") {
        addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "bill_card", content: JSON.stringify(resp.data.transaction), transaction_id: resp.data.transaction.id, created_at: new Date().toISOString() });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "text", content: resp.data?.message ?? "没听清，要不再说一次？", transaction_id: null, created_at: new Date().toISOString() });
      }
    } catch {
      addMessage({ id: Date.now().toString(), user_id: "", role: "assistant", content_type: "text", content: "网络错误，语音识别失败。", transaction_id: null, created_at: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  }, [addMessage, setLoading, qc]);

  return { sendText, sendOcr, sendAsr };
}

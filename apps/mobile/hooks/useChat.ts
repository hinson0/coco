import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { useChatStore } from "../store/chatStore";

export function useChat() {
  const { addMessage, setLoading } = useChatStore();
  const qc = useQueryClient();

  const sendText = useCallback(async (text: string) => {
    addMessage({ id: Date.now().toString(), user_id: "", role: "user", content_type: "text", content: text, transaction_id: null, created_at: new Date().toISOString() });
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
  }, [addMessage, setLoading, qc]);

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

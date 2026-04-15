import type { RecordSource } from "@coco/shared";

/**
 * 判断一笔记录是否由 AI 能力产生（应显示 AI badge）。
 * 包含：文本解析、LLM 聊天解析、语音识别、OCR 识别、通知自动记账。
 */
export function isAiSource(source: RecordSource): boolean {
  return (
    source === "text" ||
    source === "asr" ||
    source === "ocr" ||
    source === "llm" ||
    source === "notification"
  );
}

/** 判断一笔记录是否来自通知自动记账（应显示"自动记"badge）。 */
export function isNotificationSource(source: RecordSource): boolean {
  return source === "notification";
}

// text 为未使用的旧版 source，不需要展示标签
const SOURCE_LABELS: Partial<Record<RecordSource, string>> = {
  asr: "语音记",
  ocr: "小票记",
  llm: "文字记",
};

/** 获取来源类型的展示标签。手动记账和通知（已有自动记 badge）返回 null。 */
export function getSourceLabel(source: RecordSource): string | null {
  return SOURCE_LABELS[source] ?? null;
}

/** 获取通知来源的支付渠道标签（微信·自动记 / 支付宝·自动记 / 自动记）。 */
export function getNotificationLabel(rawInput?: string | null): string {
  if (rawInput?.includes("com.tencent.mm")) return "微信·自动记";
  if (rawInput?.includes("com.eg.android.AlipayGphone")) return "支付宝·自动记";
  return "自动记";
}

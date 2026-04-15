import type { RecordSource } from "@coco/shared";

/**
 * 判断一笔记录是否由 AI 能力产生（应显示 AI badge）。
 * 包含：文本解析、语音识别、OCR 识别、通知自动记账。
 */
export function isAiSource(source: RecordSource): boolean {
  return (
    source === "text" ||
    source === "asr" ||
    source === "ocr" ||
    source === "notification"
  );
}

/** 判断一笔记录是否来自通知自动记账（应显示"自动记"badge）。 */
export function isNotificationSource(source: RecordSource): boolean {
  return source === "notification";
}

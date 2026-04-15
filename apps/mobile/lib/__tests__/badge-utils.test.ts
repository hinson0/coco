import { isAiSource, isNotificationSource } from "../badge-utils";
import type { RecordSource } from "@coco/shared";

describe("isAiSource", () => {
  const aiSources: RecordSource[] = ["text", "asr", "ocr", "notification"];
  const nonAiSources: RecordSource[] = ["manual", "llm"];

  test.each(aiSources)("source '%s' 应视为 AI 记录", (source) => {
    expect(isAiSource(source)).toBe(true);
  });

  test.each(nonAiSources)("source '%s' 不应视为 AI 记录", (source) => {
    expect(isAiSource(source)).toBe(false);
  });

  test("notification（自动记）应同时显示 AI badge", () => {
    // 这是本次修复的核心：自动记账也属于 AI 能力
    expect(isAiSource("notification")).toBe(true);
  });
});

describe("isNotificationSource", () => {
  test("notification 返回 true", () => {
    expect(isNotificationSource("notification")).toBe(true);
  });

  const nonNotificationSources: RecordSource[] = ["text", "asr", "ocr", "manual", "llm"];
  test.each(nonNotificationSources)("source '%s' 返回 false", (source) => {
    expect(isNotificationSource(source)).toBe(false);
  });
});

import {
  isAiSource,
  isNotificationSource,
  getSourceLabel,
  getNotificationLabel,
} from "../badge-utils";
import type { RecordSource } from "@coco/shared";

describe("isAiSource", () => {
  const aiSources: RecordSource[] = [
    "text",
    "asr",
    "ocr",
    "notification",
    "llm",
  ];
  const nonAiSources: RecordSource[] = ["manual"];

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

  const nonNotificationSources: RecordSource[] = [
    "text",
    "asr",
    "ocr",
    "manual",
    "llm",
  ];
  test.each(nonNotificationSources)("source '%s' 返回 false", (source) => {
    expect(isNotificationSource(source)).toBe(false);
  });
});

describe("getSourceLabel", () => {
  test("asr → 语音记", () => {
    expect(getSourceLabel("asr")).toBe("语音记");
  });

  test("ocr → 小票记", () => {
    expect(getSourceLabel("ocr")).toBe("小票记");
  });

  test("llm → 文字记", () => {
    expect(getSourceLabel("llm")).toBe("文字记");
  });

  const noLabelSources: RecordSource[] = ["manual", "notification", "text"];
  test.each(noLabelSources)("source '%s' → null", (source) => {
    expect(getSourceLabel(source)).toBeNull();
  });
});

describe("getNotificationLabel", () => {
  test("微信包名 → 微信·自动记", () => {
    expect(getNotificationLabel("com.tencent.mm")).toBe("微信·自动记");
  });

  test("支付宝包名 → 支付宝·自动记", () => {
    expect(getNotificationLabel("com.eg.android.AlipayGphone")).toBe(
      "支付宝·自动记",
    );
  });

  test("其他包名 → 自动记", () => {
    expect(getNotificationLabel("com.other.app")).toBe("自动记");
  });

  test("null → 自动记", () => {
    expect(getNotificationLabel(null)).toBe("自动记");
  });

  test("undefined → 自动记", () => {
    expect(getNotificationLabel(undefined)).toBe("自动记");
  });
});

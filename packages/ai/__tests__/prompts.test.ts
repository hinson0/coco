import { describe, it, expect } from "vitest";
import {
  buildOcrExtractPrompt,
  buildAsrExtractPrompt,
  buildIntentClassifyPrompt,
  buildText2SqlPrompt,
  buildSummarizePrompt,
} from "../src/glm/prompts";

describe("buildOcrExtractPrompt", () => {
  it("should include ocr text in prompt", () => {
    const result = buildOcrExtractPrompt("星巴克 拿铁 ¥38.00 2026-03-13");
    expect(result).toContain("星巴克 拿铁 ¥38.00 2026-03-13");
    expect(result).toContain("JSON");
  });
});

describe("buildAsrExtractPrompt", () => {
  it("should include asr text and current time", () => {
    const result = buildAsrExtractPrompt("午饭花了35块", "2026-03-13T12:00:00+08:00");
    expect(result).toContain("午饭花了35块");
    expect(result).toContain("2026-03-13");
  });
});

describe("buildIntentClassifyPrompt", () => {
  it("should include user text", () => {
    const result = buildIntentClassifyPrompt("午饭35");
    expect(result).toContain("午饭35");
    expect(result).toContain("record");
    expect(result).toContain("query");
  });
});

describe("buildText2SqlPrompt", () => {
  it("should include schema info and question", () => {
    const result = buildText2SqlPrompt("上周吃饭花了多少", "2026-03-13T12:00:00+08:00");
    expect(result).toContain("上周吃饭花了多少");
    expect(result).toContain("transactions");
    expect(result).toContain("SELECT");
  });
});

describe("buildSummarizePrompt", () => {
  it("should include query result", () => {
    const result = buildSummarizePrompt("上周吃饭花了多少", '[{"sum": 287.5}]');
    expect(result).toContain("287.5");
  });
});

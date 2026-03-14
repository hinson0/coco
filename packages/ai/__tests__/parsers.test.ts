import { describe, it, expect } from "vitest";
import { parseRecordResponse, parseIntentResponse, parseSqlResponse } from "../src/glm/parsers";

describe("parseRecordResponse", () => {
  it("should parse valid JSON response", () => {
    const raw = '{"amount": 35, "category": "餐饮", "note": "午饭汉堡", "occurred_at": "2026-03-13T12:00:00"}';
    const result = parseRecordResponse(raw);
    expect(result).toEqual({ amount: 35, category: "餐饮", note: "午饭汉堡", occurred_at: "2026-03-13T12:00:00", type: "expense" });
  });

  it("should extract JSON from markdown code block", () => {
    const raw = '```json\n{"amount": 20, "category": "交通", "note": "打车", "occurred_at": null}\n```';
    const result = parseRecordResponse(raw);
    expect(result?.amount).toBe(20);
  });

  it("should return null for invalid response", () => {
    expect(parseRecordResponse("无法识别")).toBeNull();
  });

  it("should return null if amount is missing", () => {
    expect(parseRecordResponse('{"category": "餐饮"}')).toBeNull();
  });
});

describe("parseIntentResponse", () => {
  it("should parse record intent", () => {
    expect(parseIntentResponse('{"intent": "record"}')).toBe("record");
  });
  it("should parse query intent", () => {
    expect(parseIntentResponse('{"intent": "query"}')).toBe("query");
  });
  it("should default to record for invalid response", () => {
    expect(parseIntentResponse("garbage")).toBe("record");
  });
});

describe("parseSqlResponse", () => {
  it("should extract SQL from response", () => {
    const raw = "```sql\nSELECT SUM(amount) FROM transactions WHERE deleted_at IS NULL\n```";
    expect(parseSqlResponse(raw)).toBe("SELECT SUM(amount) FROM transactions WHERE deleted_at IS NULL");
  });
  it("should handle raw SQL without code block", () => {
    const raw = "SELECT COUNT(*) FROM transactions WHERE deleted_at IS NULL";
    expect(parseSqlResponse(raw)).toBe(raw);
  });
});

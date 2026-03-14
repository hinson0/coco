export interface ParsedRecord {
  readonly amount: number;
  readonly category: string;
  readonly note: string;
  readonly occurred_at: string | null;
  readonly type: "income" | "expense";
}

function extractJson(raw: string): string {
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return raw.trim();
}

export function parseRecordResponse(raw: string): ParsedRecord | null {
  try {
    const jsonStr = extractJson(raw);
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed.amount !== "number" || parsed.amount <= 0) return null;
    return {
      amount: parsed.amount,
      category: parsed.category ?? "其他支出",
      note: parsed.note ?? "",
      occurred_at: parsed.occurred_at ?? null,
      type: parsed.type === "income" ? "income" : "expense",
    };
  } catch {
    return null;
  }
}

export function parseIntentResponse(raw: string): "record" | "query" {
  try {
    const jsonStr = extractJson(raw);
    const parsed = JSON.parse(jsonStr);
    if (parsed.intent === "query") return "query";
    return "record";
  } catch {
    return "record";
  }
}

export function parseSqlResponse(raw: string): string {
  const codeBlockMatch = raw.match(/```(?:sql)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  return raw.trim();
}

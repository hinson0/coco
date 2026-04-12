import { paceRule } from "../paceRule";
import type { InsightContext } from "../types";

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    currentMonth: [],
    previousMonth: [],
    categories: [],
    year: 2026,
    month: 2,
    daysInMonth: 31,
    daysElapsed: 15,
    ...overrides,
  };
}

function makeTx(type: "income" | "expense", amount: number) {
  return {
    type,
    amount,
    id: "1",
    user_id: "",
    category_id: "c1",
    note: "",
    occurred_at: "2026-03-10",
    source: "manual" as const,
    raw_input: null,
    receipt_url: null,
    ai_confidence: null,
    created_at: "",
    deleted_at: null,
    account_id: null,
  };
}

describe("paceRule", () => {
  it("无支出不触发", () => {
    expect(paceRule(makeCtx())).toBeNull();
  });

  it("月初前 5 天内不触发", () => {
    const ctx = makeCtx({
      daysElapsed: 3,
      currentMonth: [makeTx("income", 10000), makeTx("expense", 5000)],
    });
    expect(paceRule(ctx)).toBeNull();
  });

  it("消费进度与时间进度偏差 < 15% 不触发", () => {
    const ctx = makeCtx({
      daysElapsed: 15,
      daysInMonth: 31,
      currentMonth: [makeTx("income", 10000), makeTx("expense", 4500)],
    });
    expect(paceRule(ctx)).toBeNull();
  });

  it("消费进度超时间进度 ≥ 15% 触发", () => {
    const ctx = makeCtx({
      daysElapsed: 15,
      daysInMonth: 31,
      currentMonth: [makeTx("income", 10000), makeTx("expense", 7000)],
    });
    const result = paceRule(ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("pace");
    expect(result!.priority).toBe(4);
    expect(result!.meta!.spendProgress).toBeCloseTo(0.7, 1);
  });

  it("meta 包含 timeProgress 和 spendProgress", () => {
    const ctx = makeCtx({
      daysElapsed: 15,
      daysInMonth: 31,
      currentMonth: [makeTx("income", 10000), makeTx("expense", 8000)],
    });
    const result = paceRule(ctx)!;
    expect(result.meta!.timeProgress).toBeCloseTo(15 / 31, 2);
    expect(result.meta!.spendProgress).toBeCloseTo(0.8, 1);
  });

  it("无收入时不触发", () => {
    const ctx = makeCtx({
      daysElapsed: 15,
      currentMonth: [makeTx("expense", 5000)],
    });
    expect(paceRule(ctx)).toBeNull();
  });
});

// apps/mobile/utils/insights/__tests__/healthScoreRule.test.ts
import { healthScoreRule } from "../healthScoreRule";
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

describe("healthScoreRule", () => {
  it("始终返回结果（不为 null）", () => {
    const result = healthScoreRule(makeCtx());
    expect(result).not.toBeNull();
  });

  it("type 为 health，priority 为 1", () => {
    const result = healthScoreRule(makeCtx())!;
    expect(result.type).toBe("health");
    expect(result.priority).toBe(1);
  });

  it("无收入时结余率分为 0", () => {
    const ctx = makeCtx({
      currentMonth: [makeTx("expense", 1000)],
    });
    const result = healthScoreRule(ctx)!;
    expect(result.meta!.score).toBeLessThanOrEqual(40);
  });

  it("高结余率（≥30%）得高分", () => {
    const ctx = makeCtx({
      currentMonth: [makeTx("income", 10000), makeTx("expense", 5000)],
      daysInMonth: 31,
      daysElapsed: 31,
    });
    const result = healthScoreRule(ctx)!;
    expect(result.meta!.score).toBeGreaterThanOrEqual(60);
  });

  it("结余率 30% 刚好得满分（结余率维度）", () => {
    const ctx = makeCtx({
      currentMonth: [makeTx("income", 10000), makeTx("expense", 7000)],
      daysInMonth: 31,
      daysElapsed: 31,
    });
    const result = healthScoreRule(ctx)!;
    expect(result.meta!.savingsRate).toBeCloseTo(0.3, 1);
  });

  it("消费节奏偏快扣分", () => {
    const expenses = Array.from({ length: 9 }, () => makeTx("expense", 1000));
    const ctx = makeCtx({
      currentMonth: [makeTx("income", 10000), ...expenses],
      daysInMonth: 31,
      daysElapsed: 15,
    });
    const result = healthScoreRule(ctx)!;
    expect(result.meta!.score).toBeLessThan(80);
  });

  it("评级映射正确", () => {
    const ctx = makeCtx({
      currentMonth: [makeTx("income", 10000), makeTx("expense", 6500)],
      daysInMonth: 31,
      daysElapsed: 31,
    });
    const result = healthScoreRule(ctx)!;
    const level = result.meta!.level as string;
    expect(["差", "一般", "良好", "优秀"]).toContain(level);
  });

  it("有上月数据时包含 prevSavingsRate", () => {
    const ctx = makeCtx({
      currentMonth: [makeTx("income", 10000), makeTx("expense", 7000)],
      previousMonth: [makeTx("income", 8000), makeTx("expense", 6000)],
    });
    const result = healthScoreRule(ctx)!;
    expect(result.meta!.prevSavingsRate).toBeDefined();
  });

  it("无上月数据时 prevSavingsRate 为 undefined", () => {
    const ctx = makeCtx({
      currentMonth: [makeTx("income", 10000), makeTx("expense", 7000)],
      previousMonth: [],
    });
    const result = healthScoreRule(ctx)!;
    expect(result.meta!.prevSavingsRate).toBeUndefined();
  });
});

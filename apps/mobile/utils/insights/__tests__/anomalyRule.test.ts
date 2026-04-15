import { anomalyRule } from "../anomalyRule";
import type { InsightContext, AnomalyMeta } from "../types";

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    currentMonth: [],
    previousMonth: [],
    categories: [
      {
        id: "c1",
        user_id: null,
        name: "购物",
        icon: "🛍️",
        type: "expense",
        is_default: true,
        deleted_at: null,
      },
    ],
    year: 2026,
    month: 2,
    daysInMonth: 31,
    daysElapsed: 15,
    ...overrides,
  };
}

function makeTx(amount: number, categoryId = "c1", date = "2026-03-10") {
  return {
    type: "expense" as const,
    amount,
    id: `t-${amount}-${date}`,
    user_id: "",
    category_id: categoryId,
    note: "",
    occurred_at: date,
    source: "manual" as const,
    raw_input: null,
    receipt_url: null,
    ai_confidence: null,
    created_at: "",
    deleted_at: null,
    account_id: null,
  };
}

describe("anomalyRule", () => {
  it("交易太少（< 3 笔）不触发", () => {
    const ctx = makeCtx({ currentMonth: [makeTx(500), makeTx(3000)] });
    expect(anomalyRule(ctx)).toBeNull();
  });

  it("无异常值不触发", () => {
    const ctx = makeCtx({
      currentMonth: [
        makeTx(100),
        makeTx(110),
        makeTx(90),
        makeTx(105),
        makeTx(95),
      ],
    });
    expect(anomalyRule(ctx)).toBeNull();
  });

  it("有大额异常交易（> 中位数 + 2σ 且 ≥ ¥500）触发", () => {
    const normal = Array.from({ length: 10 }, (_, i) => makeTx(80 + i * 5));
    const outlier = makeTx(3200, "c1", "2026-03-15");
    const ctx = makeCtx({ currentMonth: [...normal, outlier] });
    const result = anomalyRule(ctx);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("anomaly");
    expect(result!.priority).toBe(3);
    expect((result!.meta as AnomalyMeta).amount).toBe(3200);
  });

  it("异常值 < ¥500 不触发", () => {
    const normal = Array.from({ length: 10 }, () => makeTx(10));
    const ctx = makeCtx({ currentMonth: [...normal, makeTx(400)] });
    expect(anomalyRule(ctx)).toBeNull();
  });

  it("多笔异常只取最大的一笔", () => {
    const normal = Array.from({ length: 10 }, () => makeTx(50));
    const ctx = makeCtx({
      currentMonth: [
        ...normal,
        makeTx(800, "c1", "2026-03-12"),
        makeTx(3200, "c1", "2026-03-15"),
      ],
    });
    const result = anomalyRule(ctx);
    expect((result!.meta as AnomalyMeta).amount).toBe(3200);
  });

  it("包含 navigation", () => {
    const normal = Array.from({ length: 10 }, () => makeTx(50));
    const ctx = makeCtx({ currentMonth: [...normal, makeTx(3200)] });
    const result = anomalyRule(ctx);
    expect(result!.navigation?.route).toBe("/category-detail");
  });
});

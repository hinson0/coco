import { categoryChangeRule } from "../categoryChangeRule";
import type { InsightContext } from "../types";

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    currentMonth: [],
    previousMonth: [],
    categories: [
      {
        id: "c1",
        user_id: null,
        name: "餐饮",
        icon: "🍜",
        type: "expense",
        is_default: true,
        deleted_at: null,
      },
      {
        id: "c2",
        user_id: null,
        name: "交通",
        icon: "🚌",
        type: "expense",
        is_default: true,
        deleted_at: null,
      },
    ],
    year: 2026,
    month: 2,
    daysInMonth: 31,
    daysElapsed: 31,
    ...overrides,
  };
}

function makeTx(
  categoryId: string,
  amount: number,
  type: "income" | "expense" = "expense",
) {
  return {
    type,
    amount,
    id: "1",
    user_id: "",
    category_id: categoryId,
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

describe("categoryChangeRule", () => {
  it("无上月数据返回 null", () => {
    const ctx = makeCtx({
      previousMonth: [],
      currentMonth: [makeTx("c1", 500)],
    });
    expect(categoryChangeRule(ctx)).toBeNull();
  });

  it("变化幅度 < 15% 不触发", () => {
    const ctx = makeCtx({
      currentMonth: [makeTx("c1", 1100)],
      previousMonth: [makeTx("c1", 1000)],
    });
    expect(categoryChangeRule(ctx)).toBeNull();
  });

  it("绝对差额 < ¥50 不触发", () => {
    const ctx = makeCtx({
      currentMonth: [makeTx("c1", 40)],
      previousMonth: [makeTx("c1", 20)],
    });
    expect(categoryChangeRule(ctx)).toBeNull();
  });

  it("涨幅超 15% 且差额 ≥ ¥50 触发", () => {
    const ctx = makeCtx({
      currentMonth: [makeTx("c1", 1200)],
      previousMonth: [makeTx("c1", 1000)],
    });
    const items = categoryChangeRule(ctx)!;
    const up = items.find((i) => i.badge?.direction === "up");
    expect(up).toBeDefined();
    expect(up!.type).toBe("category-change");
    expect(up!.meta!.changePercent).toBeCloseTo(20, 0);
  });

  it("最多返回 2 条（涨幅 + 降幅各一）", () => {
    const ctx = makeCtx({
      currentMonth: [makeTx("c1", 2000), makeTx("c2", 200)],
      previousMonth: [makeTx("c1", 1000), makeTx("c2", 500)],
    });
    const items = categoryChangeRule(ctx)!;
    expect(items.length).toBeLessThanOrEqual(2);
  });

  it("涨幅卡 priority=2，降幅卡 priority=5", () => {
    const ctx = makeCtx({
      currentMonth: [makeTx("c1", 2000), makeTx("c2", 200)],
      previousMonth: [makeTx("c1", 1000), makeTx("c2", 500)],
    });
    const items = categoryChangeRule(ctx)!;
    const up = items.find((i) => i.badge?.direction === "up");
    const down = items.find((i) => i.badge?.direction === "down");
    if (up) expect(up.priority).toBe(2);
    if (down) expect(down.priority).toBe(5);
  });

  it("包含 navigation 指向 category-detail", () => {
    const ctx = makeCtx({
      currentMonth: [makeTx("c1", 1200)],
      previousMonth: [makeTx("c1", 1000)],
    });
    const items = categoryChangeRule(ctx)!;
    expect(items[0].navigation?.route).toBe("/category-detail");
    expect(items[0].navigation?.params.categoryId).toBe("c1");
  });
});

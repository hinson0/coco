import { calculateDailyDecay } from "../decay";

describe("calculateDailyDecay", () => {
  it("同一天内不衰减", () => {
    const lastDecay = "2026-04-07T00:00:00.000Z";
    const now = "2026-04-07T23:59:59.000Z";
    expect(calculateDailyDecay(10, lastDecay, now)).toBe(0);
  });

  it("过了 1 天衰减 1", () => {
    const lastDecay = "2026-04-07T00:00:00.000Z";
    const now = "2026-04-08T01:00:00.000Z";
    expect(calculateDailyDecay(10, lastDecay, now)).toBe(1);
  });

  it("过了 3 天衰减 3", () => {
    const lastDecay = "2026-04-07T00:00:00.000Z";
    const now = "2026-04-10T12:00:00.000Z";
    expect(calculateDailyDecay(10, lastDecay, now)).toBe(3);
  });

  it("衰减不超过余额", () => {
    const lastDecay = "2026-04-07T00:00:00.000Z";
    const now = "2026-04-20T00:00:00.000Z"; // 13 天
    expect(calculateDailyDecay(5, lastDecay, now)).toBe(5);
  });

  it("余额为 0 不衰减", () => {
    const lastDecay = "2026-04-07T00:00:00.000Z";
    const now = "2026-04-10T00:00:00.000Z";
    expect(calculateDailyDecay(0, lastDecay, now)).toBe(0);
  });

  it("lastDecay 为 null 不衰减（首次）", () => {
    expect(calculateDailyDecay(10, null, "2026-04-10T00:00:00.000Z")).toBe(0);
  });
});

import { extractAmount } from "@/lib/rule-engine/extract-amount";

describe("extractAmount", () => {
  it("'午饭25元' → 25", () => {
    expect(extractAmount("午饭25元")).toBe(25);
  });

  it("'打车15.5' → 15.5", () => {
    expect(extractAmount("打车15.5")).toBe(15.5);
  });

  it("'¥100买书' → 100", () => {
    expect(extractAmount("¥100买书")).toBe(100);
  });

  it("'￥88.8红包' → 88.8", () => {
    expect(extractAmount("￥88.8红包")).toBe(88.8);
  });

  it("'花了50块' → 50", () => {
    expect(extractAmount("花了50块")).toBe(50);
  });

  it("没有金额 '买了本书' → null", () => {
    expect(extractAmount("买了本书")).toBeNull();
  });

  it("金额为 0 → null", () => {
    expect(extractAmount("0元")).toBeNull();
  });

  it("空字符串 → null", () => {
    expect(extractAmount("")).toBeNull();
  });
});

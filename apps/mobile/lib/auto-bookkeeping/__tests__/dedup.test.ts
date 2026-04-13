import { isDuplicate, type DedupItem } from "../dedup";

describe("isDuplicate", () => {
  const baseItem: DedupItem = {
    amount: 25.5,
    source: "wechat",
    timestamp: 1000000,
  };

  it("空队列返回 false", () => {
    expect(isDuplicate(baseItem, [])).toBe(false);
  });

  it("相同金额+来源+10s内 = 重复", () => {
    const existing: DedupItem[] = [
      { amount: 25.5, source: "wechat", timestamp: 995000 },
    ];
    expect(isDuplicate(baseItem, existing)).toBe(true);
  });

  it("相同金额+来源+超过10s = 非重复", () => {
    const existing: DedupItem[] = [
      { amount: 25.5, source: "wechat", timestamp: 989000 },
    ];
    expect(isDuplicate(baseItem, existing)).toBe(false);
  });

  it("相同金额+不同来源 = 非重复", () => {
    const existing: DedupItem[] = [
      { amount: 25.5, source: "alipay", timestamp: 999000 },
    ];
    expect(isDuplicate(baseItem, existing)).toBe(false);
  });

  it("不同金额+相同来源 = 非重复", () => {
    const existing: DedupItem[] = [
      { amount: 30, source: "wechat", timestamp: 999000 },
    ];
    expect(isDuplicate(baseItem, existing)).toBe(false);
  });

  it("恰好10s边界 = 非重复（严格小于）", () => {
    const existing: DedupItem[] = [
      { amount: 25.5, source: "wechat", timestamp: 990000 },
    ];
    expect(isDuplicate(baseItem, existing)).toBe(false);
  });

  it("9999ms 差值 = 重复", () => {
    const existing: DedupItem[] = [
      { amount: 25.5, source: "wechat", timestamp: 990001 },
    ];
    expect(isDuplicate(baseItem, existing)).toBe(true);
  });

  it("多条记录中有一条匹配 = 重复", () => {
    const existing: DedupItem[] = [
      { amount: 10, source: "alipay", timestamp: 999000 },
      { amount: 25.5, source: "wechat", timestamp: 999000 },
      { amount: 50, source: "wechat", timestamp: 999000 },
    ];
    expect(isDuplicate(baseItem, existing)).toBe(true);
  });

  it("自定义窗口大小", () => {
    const existing: DedupItem[] = [
      { amount: 25.5, source: "wechat", timestamp: 995000 },
    ];
    expect(isDuplicate(baseItem, existing, 3000)).toBe(false);
    expect(isDuplicate(baseItem, existing, 6000)).toBe(true);
  });
});

import { stripAmount } from "./strip-amount";

describe("stripAmount", () => {
  it("strips plain numbers", () => {
    expect(stripAmount("买车100000")).toBe("买车");
  });

  it("strips yen-prefixed amounts", () => {
    expect(stripAmount("咖啡¥25")).toBe("咖啡");
    expect(stripAmount("咖啡￥25")).toBe("咖啡");
  });

  it("strips decimal amounts", () => {
    expect(stripAmount("买车99999.99")).toBe("买车");
  });

  it("strips amounts with 元/块 suffix", () => {
    expect(stripAmount("午饭35元")).toBe("午饭");
    expect(stripAmount("打车20块")).toBe("打车");
  });

  it("returns empty string for pure number input", () => {
    expect(stripAmount("10086")).toBe("");
  });

  it("preserves non-numeric text", () => {
    expect(stripAmount("星巴克咖啡")).toBe("星巴克咖啡");
  });

  it("handles mixed text and multiple numbers", () => {
    expect(stripAmount("买了2杯咖啡50")).toBe("买了杯咖啡");
  });
});

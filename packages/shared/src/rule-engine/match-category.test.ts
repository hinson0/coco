import { matchCategory } from "./match-category";

describe("matchCategory", () => {
  // Bug fix: 数字子串不应误匹配
  it('does not match "10000" inside "买车100000"', () => {
    expect(matchCategory("买车100000")).not.toBe("通讯");
  });

  it('matches "买车100000" to 购物', () => {
    expect(matchCategory("买车100000")).toBe("购物");
  });

  it('matches "买车99999.99" to 购物', () => {
    expect(matchCategory("买车99999.99")).toBe("购物");
  });

  // 纯数字关键词仍然有效
  it('matches "10086" to 通讯 (boundary match)', () => {
    expect(matchCategory("10086")).toBe("通讯");
  });

  it('matches "10010" to 通讯 (boundary match)', () => {
    expect(matchCategory("10010")).toBe("通讯");
  });

  it('matches "10000" to 通讯 (exact, not inside larger number)', () => {
    expect(matchCategory("10000")).toBe("通讯");
  });

  it('does not match "10000" inside "210000"', () => {
    expect(matchCategory("210000")).not.toBe("通讯");
  });

  // 常规文字关键词
  it('matches "话费100" to 通讯', () => {
    expect(matchCategory("话费100")).toBe("通讯");
  });

  it('matches "咖啡25" to 餐饮', () => {
    expect(matchCategory("咖啡25")).toBe("餐饮");
  });

  // 无匹配返回 null
  it("returns null for unrecognized input", () => {
    expect(matchCategory("12345")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(matchCategory("")).toBeNull();
  });
});

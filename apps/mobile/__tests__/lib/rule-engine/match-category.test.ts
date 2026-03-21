import { matchCategory } from "@/lib/rule-engine/match-category";

describe("matchCategory", () => {
  it("'午饭' → 餐饮", () => {
    expect(matchCategory("午饭25元")).toBe("餐饮");
  });

  it("'打车去公司' → 交通", () => {
    expect(matchCategory("打车去公司15")).toBe("交通");
  });

  it("'超市买菜' → 购物", () => {
    expect(matchCategory("超市买菜80")).toBe("购物");
  });

  it("'看病挂号' → 医疗", () => {
    expect(matchCategory("看病挂号50")).toBe("医疗");
  });

  it("无法匹配 → null", () => {
    expect(matchCategory("随便花了点钱")).toBeNull();
  });
});

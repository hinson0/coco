import { parse } from "@/lib/rule-engine";

describe("rule engine parse()", () => {
  it("完整匹配: '午饭25元'", () => {
    const result = parse("午饭25元");
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(25);
    expect(result!.type).toBe("expense");
    expect(result!.categoryName).toBe("餐饮");
    expect(result!.note).toBe("午饭");
  });

  it("金额匹配但分类未命中: '花了50块'", () => {
    const result = parse("花了50块");
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(50);
    expect(result!.categoryName).toBeNull();
  });

  it("收入识别: '工资3000'", () => {
    const result = parse("工资3000");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("income");
    expect(result!.amount).toBe(3000);
  });

  it("无金额 → null: '买了本书'", () => {
    expect(parse("买了本书")).toBeNull();
  });

  it("空字符串 → null", () => {
    expect(parse("")).toBeNull();
  });

  it("带符号: '¥88.5咖啡'", () => {
    const result = parse("¥88.5咖啡");
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(88.5);
    expect(result!.categoryName).toBe("餐饮");
  });
});

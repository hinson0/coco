import { parse } from "./index";

describe("parse", () => {
  it('parses "买车100000" as 购物 expense', () => {
    const result = parse("买车100000");
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(100000);
    expect(result!.categoryName).toBe("购物");
    expect(result!.type).toBe("expense");
  });

  it('parses "话费100" as 通讯 expense', () => {
    const result = parse("话费100");
    expect(result).not.toBeNull();
    expect(result!.categoryName).toBe("通讯");
  });

  it('parses "提车50000" as 购物', () => {
    const result = parse("提车50000");
    expect(result).not.toBeNull();
    expect(result!.categoryName).toBe("购物");
  });

  it('parses "买房2000000" as 居住', () => {
    const result = parse("买房2000000");
    expect(result).not.toBeNull();
    expect(result!.categoryName).toBe("居住");
  });

  it('parses "工资10000" as income', () => {
    const result = parse("工资10000");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("income");
    expect(result!.amount).toBe(10000);
  });

  it('parses "366666" with no category', () => {
    const result = parse("366666");
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(366666);
    expect(result!.categoryName).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parse("")).toBeNull();
  });

  it("returns null for text without amount", () => {
    expect(parse("你好")).toBeNull();
  });
});

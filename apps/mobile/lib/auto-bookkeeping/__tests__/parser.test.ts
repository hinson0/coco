import { parseNotification, isSupportedPackage } from "../parser";

describe("parseNotification", () => {
  describe("微信支付", () => {
    const pkg = "com.tencent.mm";

    it("解析收款通知", () => {
      const result = parseNotification(
        pkg,
        "微信支付",
        "微信支付收款到账10.00元",
      );
      expect(result).toEqual({
        amount: 10,
        source: "wechat",
        type: "income",
        rawTitle: "微信支付",
        rawText: "微信支付收款到账10.00元",
      });
    });

    it("解析付款通知", () => {
      const result = parseNotification(pkg, "微信支付", "已扣费0.01元");
      expect(result).toEqual({
        amount: 0.01,
        source: "wechat",
        type: "expense",
        rawTitle: "微信支付",
        rawText: "已扣费0.01元",
      });
    });

    it("解析收款带括号商户", () => {
      const result = parseNotification(
        pkg,
        "微信支付",
        "微信支付收款0.01元(朋友到店)",
      );
      expect(result).toEqual({
        amount: 0.01,
        source: "wechat",
        type: "income",
        rawTitle: "微信支付",
        rawText: "微信支付收款0.01元(朋友到店)",
      });
    });

    it("解析聚合通知", () => {
      const result = parseNotification(
        pkg,
        "微信支付",
        "[4条]微信支付: 微信支付收款1.01元(朋友到店)",
      );
      expect(result).toEqual({
        amount: 1.01,
        source: "wechat",
        type: "income",
        rawTitle: "微信支付",
        rawText: "[4条]微信支付: 微信支付收款1.01元(朋友到店)",
      });
    });

    it("解析转账付款", () => {
      const result = parseNotification(
        pkg,
        "微信支付",
        "你已成功向xxx付款1.00元",
      );
      expect(result).toEqual({
        amount: 1,
        source: "wechat",
        type: "expense",
        rawTitle: "微信支付",
        rawText: "你已成功向xxx付款1.00元",
      });
    });

    it("解析消费通知", () => {
      const result = parseNotification(
        pkg,
        "微信支付",
        "你在美团外卖消费了25.50元",
      );
      expect(result).toEqual({
        amount: 25.5,
        source: "wechat",
        type: "expense",
        rawTitle: "微信支付",
        rawText: "你在美团外卖消费了25.50元",
      });
    });
  });

  describe("支付宝", () => {
    const pkg = "com.eg.android.AlipayGphone";

    it("解析收款通知", () => {
      const result = parseNotification(pkg, "支付宝", "支付宝成功收款1.00元。");
      expect(result).toEqual({
        amount: 1,
        source: "alipay",
        type: "income",
        rawTitle: "支付宝",
        rawText: "支付宝成功收款1.00元。",
      });
    });

    it("解析付款通知", () => {
      const result = parseNotification(
        pkg,
        "支付宝通知",
        "你已成功付款25.50元",
      );
      expect(result).toEqual({
        amount: 25.5,
        source: "alipay",
        type: "expense",
        rawTitle: "支付宝通知",
        rawText: "你已成功付款25.50元",
      });
    });

    it("解析转账到账", () => {
      const result = parseNotification(
        pkg,
        "支付宝",
        "收到一笔转账到账100.00元",
      );
      expect(result).toEqual({
        amount: 100,
        source: "alipay",
        type: "income",
        rawTitle: "支付宝",
        rawText: "收到一笔转账到账100.00元",
      });
    });
  });

  describe("边界情况", () => {
    it("不支持的包名返回 null", () => {
      expect(
        parseNotification("com.example.app", "Test", "付款10元"),
      ).toBeNull();
    });

    it("无金额的通知返回 null", () => {
      expect(
        parseNotification("com.tencent.mm", "微信", "您有一条新消息"),
      ).toBeNull();
    });

    it("金额为 0 返回 null", () => {
      expect(
        parseNotification("com.tencent.mm", "微信支付", "收款0元"),
      ).toBeNull();
    });

    it("无收支关键词默认为支出", () => {
      const result = parseNotification(
        "com.tencent.mm",
        "微信支付",
        "交易金额50.00元",
      );
      expect(result?.type).toBe("expense");
    });

    it("整数金额（无小数点）", () => {
      const result = parseNotification("com.tencent.mm", "微信支付", "付款5元");
      expect(result?.amount).toBe(5);
    });

    it("大额金额", () => {
      const result = parseNotification(
        "com.tencent.mm",
        "微信支付",
        "付款12345.67元",
      );
      expect(result?.amount).toBe(12345.67);
    });
  });
});

describe("isSupportedPackage", () => {
  it("微信", () => {
    expect(isSupportedPackage("com.tencent.mm")).toBe(true);
  });

  it("支付宝", () => {
    expect(isSupportedPackage("com.eg.android.AlipayGphone")).toBe(true);
  });

  it("不支持的包名", () => {
    expect(isSupportedPackage("com.example.app")).toBe(false);
  });
});

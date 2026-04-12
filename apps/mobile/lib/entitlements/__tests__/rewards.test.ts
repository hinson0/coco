import { getRewardsForWatch, CYCLE_FEATURES, BONUS_REWARDS } from "../rewards";

describe("getRewardsForWatch", () => {
  it("第 1 条广告：asr +1, multi_account +1, csv_export +1", () => {
    const rewards = getRewardsForWatch(1);
    expect(rewards).toEqual([
      { feature: "asr", amount: 1 },
      { feature: "multi_account", amount: 1 },
      { feature: "csv_export", amount: 1 },
    ]);
  });

  it("第 2 条广告：ocr +1, multi_account +1, csv_export +1", () => {
    const rewards = getRewardsForWatch(2);
    expect(rewards).toEqual([
      { feature: "ocr", amount: 1 },
      { feature: "multi_account", amount: 1 },
      { feature: "csv_export", amount: 1 },
    ]);
  });

  it("第 3 条循环回 asr", () => {
    const rewards = getRewardsForWatch(3);
    expect(rewards[0]).toEqual({ feature: "asr", amount: 1 });
  });

  it("第 4 条循环回 ocr", () => {
    const rewards = getRewardsForWatch(4);
    expect(rewards[0]).toEqual({ feature: "ocr", amount: 1 });
  });

  it("每条广告都包含 multi_account 和 csv_export", () => {
    for (let i = 1; i <= 10; i++) {
      const rewards = getRewardsForWatch(i);
      const features = rewards.map((r) => r.feature);
      expect(features).toContain("multi_account");
      expect(features).toContain("csv_export");
    }
  });

  it("第 0 条抛出错误", () => {
    expect(() => getRewardsForWatch(0)).toThrow();
  });
});

describe("CYCLE_FEATURES", () => {
  it("包含 2 个交替功能", () => {
    expect(CYCLE_FEATURES).toHaveLength(2);
    expect(CYCLE_FEATURES[0].feature).toBe("asr");
    expect(CYCLE_FEATURES[1].feature).toBe("ocr");
  });
});

describe("BONUS_REWARDS", () => {
  it("包含 multi_account 和 csv_export", () => {
    expect(BONUS_REWARDS).toHaveLength(2);
    expect(BONUS_REWARDS[0].feature).toBe("multi_account");
    expect(BONUS_REWARDS[1].feature).toBe("csv_export");
  });
});

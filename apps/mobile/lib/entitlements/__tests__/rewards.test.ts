import { getRewardForWatch, FEATURES } from '../rewards';

describe('getRewardForWatch', () => {
  it('第 1 条广告奖励 asr +1', () => {
    expect(getRewardForWatch(1)).toEqual({ feature: 'asr', amount: 1 });
  });

  it('第 2 条广告奖励 ocr +1', () => {
    expect(getRewardForWatch(2)).toEqual({ feature: 'ocr', amount: 1 });
  });

  it('第 3 条广告奖励 multi_account +7', () => {
    expect(getRewardForWatch(3)).toEqual({ feature: 'multi_account', amount: 7 });
  });

  it('第 4 条广告奖励 csv_export +1', () => {
    expect(getRewardForWatch(4)).toEqual({ feature: 'csv_export', amount: 1 });
  });

  it('第 5 条循环回 asr', () => {
    expect(getRewardForWatch(5)).toEqual({ feature: 'asr', amount: 1 });
  });

  it('第 8 条循环回 csv_export', () => {
    expect(getRewardForWatch(8)).toEqual({ feature: 'csv_export', amount: 1 });
  });

  it('第 0 条抛出错误', () => {
    expect(() => getRewardForWatch(0)).toThrow();
  });
});

describe('FEATURES', () => {
  it('包含 4 个功能', () => {
    expect(FEATURES).toHaveLength(4);
  });

  it('每个功能有 feature 和 amount', () => {
    for (const f of FEATURES) {
      expect(f).toHaveProperty('feature');
      expect(f).toHaveProperty('amount');
      expect(f.amount).toBeGreaterThan(0);
    }
  });
});

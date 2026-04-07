export type FeatureKey = 'asr' | 'ocr' | 'multi_account' | 'csv_export';

export interface Reward {
  feature: FeatureKey;
  amount: number;
}

/**
 * 4 个功能一循环。
 * amount 的含义因 feature 不同：asr/ocr 是次数，multi_account 是天数，csv_export 是周数。
 */
export const FEATURES: readonly Reward[] = [
  { feature: 'asr', amount: 1 },
  { feature: 'ocr', amount: 1 },
  { feature: 'multi_account', amount: 7 },
  { feature: 'csv_export', amount: 1 },
] as const;

/**
 * 根据累计观看条数，返回本条广告奖励的权益。
 * @param watchCount 第几条（从 1 开始）
 */
export function getRewardForWatch(watchCount: number): Reward {
  if (watchCount < 1) throw new Error('watchCount must be >= 1');
  const index = (watchCount - 1) % FEATURES.length;
  return FEATURES[index];
}

export type FeatureKey = 'asr' | 'ocr' | 'multi_account' | 'csv_export';

export interface Reward {
  feature: FeatureKey;
  amount: number;
}

/**
 * 交替循环的权益（奇数条 asr，偶数条 ocr）
 */
export const CYCLE_FEATURES: readonly Reward[] = [
  { feature: 'asr', amount: 1 },
  { feature: 'ocr', amount: 1 },
] as const;

/**
 * 每条广告都额外赠送的权益
 */
export const BONUS_REWARDS: readonly Reward[] = [
  { feature: 'multi_account', amount: 1 }, // +1 天
  { feature: 'csv_export', amount: 1 },    // +1 天
] as const;

/**
 * 根据累计观看条数，返回本条广告奖励的所有权益。
 * - 语音记账/小票识别：交替循环
 * - 多账户管理/导出CSV：每条都给
 */
export function getRewardsForWatch(watchCount: number): Reward[] {
  if (watchCount < 1) throw new Error('watchCount must be >= 1');
  const cycleIndex = (watchCount - 1) % CYCLE_FEATURES.length;
  return [CYCLE_FEATURES[cycleIndex], ...BONUS_REWARDS];
}

/** @deprecated 使用 getRewardsForWatch（返回数组） */
export function getRewardForWatch(watchCount: number): Reward {
  return getRewardsForWatch(watchCount)[0];
}

/** 兼容：旧代码中引用的 FEATURES */
export const FEATURES = CYCLE_FEATURES;

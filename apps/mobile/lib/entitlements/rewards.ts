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


/** 功能展示元数据（UI 统一引用） */
export const FEATURE_META: Record<FeatureKey, { label: string; icon: string }> = {
  asr:           { label: '语音记账', icon: '🎤' },
  ocr:           { label: '小票识别', icon: '📸' },
  multi_account: { label: '多账户管理', icon: '💳' },
  csv_export:    { label: '导出 CSV', icon: '📤' },
};

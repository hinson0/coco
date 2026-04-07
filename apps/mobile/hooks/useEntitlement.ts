import { useOfflineContext } from '@/lib/offline-context';
import type { FeatureKey } from '@/lib/entitlements/rewards';
import {
  getEntitlement,
  getAllEntitlements,
  consumeEntitlement,
  addEntitlement,
  logAdWatch,
  getTotalRewardedWatchCount,
} from '@/lib/entitlements/queries';
import { getRewardForWatch } from '@/lib/entitlements/rewards';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

const ENTITLEMENT_KEY = ['entitlements'];
const AD_WATCH_COUNT_KEY = ['ad-watch-count'];

/** 查询所有权益余额 */
export function useEntitlements() {
  const { db } = useOfflineContext();
  return useQuery({
    queryKey: ENTITLEMENT_KEY,
    queryFn: () => getAllEntitlements(db!),
    enabled: !!db,
  });
}

/** 查询单个功能权益余额 */
export function useFeatureEntitlement(feature: FeatureKey) {
  const { db } = useOfflineContext();
  return useQuery({
    queryKey: [...ENTITLEMENT_KEY, feature],
    queryFn: () => getEntitlement(db!, feature),
    enabled: !!db,
  });
}

/** 查询累计激励视频观看次数 */
export function useAdWatchCount() {
  const { db } = useOfflineContext();
  return useQuery({
    queryKey: AD_WATCH_COUNT_KEY,
    queryFn: () => getTotalRewardedWatchCount(db!),
    enabled: !!db,
  });
}

/** 使用（扣减）一次权益，返回 { success, newBalance } */
export function useConsumeEntitlement() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (feature: FeatureKey) => {
      if (!db) throw new Error('Database not ready');
      const newBalance = await consumeEntitlement(db, feature);
      return { success: newBalance >= 0, newBalance };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENTITLEMENT_KEY });
    },
  });
}

/**
 * 记录一次激励视频观看并分配权益。
 * 返回本次获得的权益信息。
 */
export function useRecordAdWatch() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { slotId: string | null; durationSec: number | null }) => {
      if (!db) throw new Error('Database not ready');

      // 1. 记录观看日志
      await logAdWatch(db, 'rewarded_video', params.slotId, params.durationSec);

      // 2. 查询当前累计观看次数（包含刚插入的这条）
      const totalCount = await getTotalRewardedWatchCount(db);

      // 3. 根据累计次数计算奖励
      const reward = getRewardForWatch(totalCount);

      // 4. 增加权益余额
      await addEntitlement(db, reward.feature, reward.amount);

      return { totalCount, reward };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENTITLEMENT_KEY });
      qc.invalidateQueries({ queryKey: AD_WATCH_COUNT_KEY });
    },
  });
}

/**
 * 检查功能权益是否可用。
 * 返回 true 表示可以使用，false 表示权益不足。
 * 如果可用，同时扣减 1 次（仅限 asr/ocr 按次计费的功能）。
 */
export function useCheckAndConsume() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();

  return useCallback(async (feature: FeatureKey): Promise<boolean> => {
    if (!db) return false;
    // TODO: Pro check — Pro 用户直接返回 true
    const ent = await getEntitlement(db, feature);
    if (ent.balance <= 0) return false;
    // 按次计费的功能立即扣减
    if (feature === 'asr' || feature === 'ocr') {
      await consumeEntitlement(db, feature);
      qc.invalidateQueries({ queryKey: ['entitlements'] });
    }
    return true;
  }, [db, qc]);
}

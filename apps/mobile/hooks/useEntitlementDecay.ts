import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineContext } from '@/lib/offline-context';
import { getEntitlement, applyDecay } from '@/lib/entitlements/queries';
import { calculateDailyDecay } from '@/lib/entitlements/decay';
import type { FeatureKey } from '@/lib/entitlements/rewards';

/**
 * 在 App 启动和从后台恢复时，检查并执行所有权益的每日衰减。
 * 所有功能（asr/ocr/multi_account/csv_export）都按天 -1。
 */
export function useEntitlementDecay() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();
  const hasRunRef = useRef(false);

  const runDecay = async () => {
    if (!db) return;
    const now = new Date().toISOString();
    let changed = false;

    const features: FeatureKey[] = ['asr', 'ocr', 'multi_account', 'csv_export'];
    for (const feature of features) {
      const ent = await getEntitlement(db, feature);
      const decay = calculateDailyDecay(ent.balance, ent.last_decay_at, now);
      if (decay > 0) {
        await applyDecay(db, feature, decay, now);
        changed = true;
      }
    }

    if (changed) {
      qc.invalidateQueries({ queryKey: ['entitlements'] });
    }
  };

  useEffect(() => {
    if (db && !hasRunRef.current) {
      hasRunRef.current = true;
      runDecay();
    }
  }, [db]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        runDecay();
      }
    });
    return () => subscription.remove();
  }, [db]);
}

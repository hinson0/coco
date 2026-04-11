import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineContext } from '@/lib/offline-context';
import { getEntitlement, applyDecay } from '@/lib/entitlements/queries';
import { calculateDailyDecay } from '@/lib/entitlements/decay';
import type { FeatureKey } from '@/lib/entitlements/rewards';

const ALL_FEATURES: FeatureKey[] = ['asr', 'ocr', 'multi_account', 'csv_export'];

/**
 * 在 App 启动和从后台恢复时，检查并执行所有权益的每日衰减。
 * 所有功能都按天 -1。
 */
export function useEntitlementDecay() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();
  const hasRunRef = useRef(false);

  // 用 ref 保持最新引用，避免闭包过期
  const dbRef = useRef(db);
  dbRef.current = db;
  const qcRef = useRef(qc);
  qcRef.current = qc;

  const runDecay = async () => {
    const currentDb = dbRef.current;
    if (!currentDb) return;
    const now = new Date().toISOString();
    let changed = false;

    for (const feature of ALL_FEATURES) {
      const ent = await getEntitlement(currentDb, feature);
      const decay = calculateDailyDecay(ent.balance, ent.last_decay_at, now);
      if (decay > 0) {
        await applyDecay(currentDb, feature, decay, now);
        changed = true;
      }
    }

    if (changed) {
      qcRef.current.invalidateQueries({ queryKey: ['entitlements'] });
    }
  };

  // App 启动时执行一次
  useEffect(() => {
    if (db && !hasRunRef.current) {
      hasRunRef.current = true;
      runDecay();
    }
  }, [db]);

  // 后台恢复时执行（只挂载一次，通过 ref 拿最新 db）
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        runDecay();
      }
    });
    return () => subscription.remove();
  }, []);
}

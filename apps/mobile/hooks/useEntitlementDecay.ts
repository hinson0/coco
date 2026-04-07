import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineContext } from '@/lib/offline-context';
import { getEntitlement, applyDecay } from '@/lib/entitlements/queries';
import { calculateDailyDecay, calculateWeeklyDecay } from '@/lib/entitlements/decay';

/**
 * 在 App 启动和从后台恢复时，检查并执行时段型权益的衰减。
 * - multi_account: 每天 -1
 * - csv_export: 每周一 -1
 *
 * 放在根布局中使用。
 */
export function useEntitlementDecay() {
  const { db } = useOfflineContext();
  const qc = useQueryClient();
  const hasRunRef = useRef(false);

  const runDecay = async () => {
    if (!db) return;
    const now = new Date().toISOString();

    // 多账户管理：按天衰减
    const multiAccount = await getEntitlement(db, 'multi_account');
    const dailyDecay = calculateDailyDecay(multiAccount.balance, multiAccount.last_decay_at, now);
    if (dailyDecay > 0) {
      await applyDecay(db, 'multi_account', dailyDecay, now);
    }

    // CSV 导出：按周衰减
    const csvExport = await getEntitlement(db, 'csv_export');
    const weeklyDecay = calculateWeeklyDecay(csvExport.balance, csvExport.last_decay_at, now);
    if (weeklyDecay > 0) {
      await applyDecay(db, 'csv_export', weeklyDecay, now);
    }

    if (dailyDecay > 0 || weeklyDecay > 0) {
      qc.invalidateQueries({ queryKey: ['entitlements'] });
    }
  };

  // App 启动时执行一次
  useEffect(() => {
    if (db && !hasRunRef.current) {
      hasRunRef.current = true;
      runDecay();
    }
  }, [db]);

  // 从后台恢复时执行
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        runDecay();
      }
    });
    return () => subscription.remove();
  }, [db]);
}

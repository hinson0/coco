// apps/mobile/app/(tabs)/bills.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ExpoPangle from '../../../modules/expo-pangle/src/ExpoPangle';
import { useAdWatchCount, useEntitlements, useRecordAdWatch } from '../../hooks/useEntitlement';
import { getRewardForWatch, FEATURES } from '../../lib/entitlements/rewards';
import { AppText } from '../../components/ui/AppText';
import { Card } from '../../components/ui/Card';
import { colors, radii, shadows } from '../../constants/theme';

// 穿山甲广告位 ID — 替换为实际值
const REWARDED_SLOT_ID = 'YOUR_REWARDED_SLOT';

const FEATURE_LABELS: Record<string, string> = {
  asr: '语音记账',
  ocr: '小票识别',
  multi_account: '多账户管理',
  csv_export: '导出 CSV',
};

const FEATURE_ICONS: Record<string, string> = {
  asr: '🎤',
  ocr: '📸',
  multi_account: '💳',
  csv_export: '📤',
};

const AMOUNT_LABELS: Record<string, string> = {
  asr: '次',
  ocr: '次',
  multi_account: '天',
  csv_export: '周',
};

type AdState = 'loading' | 'playing' | 'paused' | 'error' | 'idle';

export default function RevenueScreen() {
  const insets = useSafeAreaInsets();
  const [adState, setAdState] = useState<AdState>('idle');
  const [errorCount, setErrorCount] = useState(0);
  const isPausedRef = useRef(false);
  const isActiveRef = useRef(true);

  const { data: watchCount = 0 } = useAdWatchCount();
  const { data: entitlements = [] } = useEntitlements();
  const { mutateAsync: recordWatch } = useRecordAdWatch();

  // 下一个奖励
  const nextReward = getRewardForWatch(watchCount + 1);
  const nextLabel = FEATURE_LABELS[nextReward.feature];
  const nextIcon = FEATURE_ICONS[nextReward.feature];
  const nextAmount = nextReward.amount;
  const nextUnit = AMOUNT_LABELS[nextReward.feature];

  // 当前循环中的进度（4 个一循环）
  const posInCycle = watchCount % FEATURES.length;

  const loadAndPlay = useCallback(async () => {
    if (isPausedRef.current || !isActiveRef.current) return;
    setAdState('loading');
    try {
      await ExpoPangle.loadRewardedVideo(REWARDED_SLOT_ID);
      if (isPausedRef.current || !isActiveRef.current) return;
      setAdState('playing');
      const result = await ExpoPangle.showRewardedVideo();
      if (result.success) {
        await recordWatch({ slotId: REWARDED_SLOT_ID, durationSec: null });
        setErrorCount(0);
        // 自动加载下一条
        loadAndPlay();
      } else {
        setAdState('idle');
      }
    } catch {
      setErrorCount((prev) => {
        const next = prev + 1;
        if (next >= 3) {
          setAdState('error');
        } else {
          // 3 秒后重试
          setTimeout(() => loadAndPlay(), 3000);
        }
        return next;
      });
    }
  }, [recordWatch]);

  // 进入页面自动开始
  useEffect(() => {
    isActiveRef.current = true;
    if (!isPausedRef.current) {
      loadAndPlay();
    }
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  // 后台/前台切换
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        isActiveRef.current = true;
        if (!isPausedRef.current && adState === 'idle') {
          loadAndPlay();
        }
      } else {
        isActiveRef.current = false;
      }
    });
    return () => sub.remove();
  }, [adState, loadAndPlay]);

  const handlePauseResume = () => {
    if (isPausedRef.current) {
      isPausedRef.current = false;
      setAdState('idle');
      loadAndPlay();
    } else {
      isPausedRef.current = true;
      setAdState('paused');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" backgroundColor={colors.cream} />

      {/* Header */}
      <View style={styles.header}>
        <AppText size="5xl" weight="bold" color={colors.text}>收益</AppText>
        <View style={styles.headerRight}>
          <AppText size="base" color={colors.textLight}>累计观看</AppText>
          <View style={styles.countBadge}>
            <AppText size="lg" weight="bold" color={colors.white}>{watchCount}</AppText>
          </View>
        </View>
      </View>

      {/* 广告播放区域 */}
      <View style={styles.adContainer}>
        {adState === 'loading' && (
          <View style={styles.adCenter}>
            <AppText size="3xl">🎬</AppText>
            <AppText size="xl" color={colors.textLight} style={styles.adText}>加载中...</AppText>
          </View>
        )}
        {adState === 'playing' && (
          <View style={styles.adCenter}>
            <AppText size="3xl">▶️</AppText>
            <AppText size="xl" color={colors.textLight} style={styles.adText}>广告播放中...</AppText>
          </View>
        )}
        {adState === 'paused' && (
          <View style={styles.adCenter}>
            <AppText size="3xl">⏸️</AppText>
            <AppText size="xl" color={colors.textLight} style={styles.adText}>已暂停</AppText>
            <AppText size="base" color={colors.textLighter} style={styles.adText}>点击下方按钮继续</AppText>
          </View>
        )}
        {adState === 'error' && (
          <View style={styles.adCenter}>
            <AppText size="3xl">😴</AppText>
            <AppText size="xl" color={colors.textLight} style={styles.adText}>暂无广告，稍后再试</AppText>
            <TouchableOpacity
              style={styles.retryBtn}
              activeOpacity={0.7}
              onPress={() => { setErrorCount(0); loadAndPlay(); }}
            >
              <AppText size="lg" weight="medium" color={colors.sage}>重试</AppText>
            </TouchableOpacity>
          </View>
        )}
        {adState === 'idle' && (
          <View style={styles.adCenter}>
            <AppText size="3xl">🎬</AppText>
            <AppText size="xl" color={colors.textLight} style={styles.adText}>
              观看广告，免费解锁高级功能
            </AppText>
          </View>
        )}
      </View>

      {/* 下一个奖励进度 */}
      <View style={styles.bottomSection}>
        <Card style={styles.rewardCard}>
          <View style={styles.rewardRow}>
            <AppText size="2xl">{nextIcon}</AppText>
            <View style={styles.rewardInfo}>
              <AppText size="lg" weight="medium" color={colors.text}>
                下一个奖励: {nextLabel}
              </AppText>
              <AppText size="base" color={colors.textLight}>
                +{nextAmount} {nextUnit}
              </AppText>
            </View>
          </View>
          {/* 进度条 */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(posInCycle / FEATURES.length) * 100}%` }]} />
          </View>
          <AppText size="sm" color={colors.textLighter} style={styles.progressLabel}>
            本轮进度 {posInCycle}/{FEATURES.length}
          </AppText>
        </Card>

        {/* 控制按钮 */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlBtn, isPausedRef.current && styles.controlBtnActive]}
            activeOpacity={0.7}
            onPress={handlePauseResume}
          >
            <AppText size="lg" weight="medium" color={isPausedRef.current ? colors.white : colors.text}>
              {isPausedRef.current ? '▶ 继续' : '⏸ 暂停'}
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/ad-rewards')}
          >
            <AppText size="lg" weight="medium" color={colors.text}>📋 我的权益</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countBadge: {
    backgroundColor: colors.sage, borderRadius: radii.full,
    paddingHorizontal: 10, paddingVertical: 2,
  },
  adContainer: {
    flex: 1, marginHorizontal: 20, marginVertical: 12,
    backgroundColor: colors.white, borderRadius: radii.xl,
    ...shadows.md,
    justifyContent: 'center', alignItems: 'center',
  },
  adCenter: { alignItems: 'center', gap: 12 },
  adText: { textAlign: 'center' },
  retryBtn: {
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.sage,
  },
  bottomSection: { paddingHorizontal: 20, paddingBottom: 100 },
  rewardCard: { marginBottom: 12 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  rewardInfo: { flex: 1, gap: 2 },
  progressBar: {
    height: 6, backgroundColor: colors.creamDark, borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: colors.sage, borderRadius: 3 },
  progressLabel: { marginTop: 6, textAlign: 'right' },
  controls: { flexDirection: 'row', gap: 12 },
  controlBtn: {
    flex: 1, paddingVertical: 14, borderRadius: radii.lg,
    backgroundColor: colors.white, alignItems: 'center',
    ...shadows.sm,
  },
  controlBtnActive: { backgroundColor: colors.sage },
});

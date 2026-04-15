// apps/mobile/app/(tabs)/bills.tsx
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../components/ui/AppText";
import { Card } from "../../components/ui/Card";
import { colors, radii, shadows } from "../../constants/theme";
import { useAdWatchCount, useRecordAdWatch } from "../../hooks/useEntitlement";
import { useIsPro, useProStatus } from "../../hooks/usePro";
import {
  FEATURE_META,
  getRewardsForWatch,
} from "../../lib/entitlements/rewards";
let GoogleAds: typeof import("react-native-google-mobile-ads") | null = null;
try {
  GoogleAds = require("react-native-google-mobile-ads");
} catch {}

// AdMob 激励视频广告位（__DEV__ 时使用测试 ID）
const REWARDED_AD_ID = __DEV__
  ? (GoogleAds?.TestIds.REWARDED ?? "")
  : "ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyyyyyy";

const isPaused = (state: AdState) => state === "paused";

type AdState = "loading" | "playing" | "paused" | "error" | "idle";

export default function RevenueScreen() {
  const insets = useSafeAreaInsets();
  const isPro = useIsPro();
  const proStatus = useProStatus();
  const [adState, setAdState] = useState<AdState>("paused");
  const [, setErrorCount] = useState(0);
  const isPausedRef = useRef(true);
  const isActiveRef = useRef(true);
  const cleanupRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: watchCount = 0 } = useAdWatchCount();
  const { mutateAsync: recordWatch } = useRecordAdWatch();

  // 用 ref 存 recordWatch 避免闭包过期
  const recordWatchRef = useRef(recordWatch);
  recordWatchRef.current = recordWatch;

  // 下一条广告的奖励
  const nextRewards = getRewardsForWatch(watchCount + 1);

  // 用 ref 保存 loadAndPlay，解决递归调用闭包过期问题
  const loadAndPlayRef = useRef<() => void>(() => {});

  loadAndPlayRef.current = () => {
    if (!GoogleAds) return;
    if (isPausedRef.current || !isActiveRef.current) return;

    // 清理上一轮
    cleanupRef.current?.();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setAdState("loading");

    const rewarded = GoogleAds.RewardedAd.createForAdRequest(REWARDED_AD_ID);
    let settled = false; // 防止重复处理

    /** 只在未暂停时调度下一轮，否则回到暂停状态 */
    function scheduleNext(delayMs: number) {
      if (isPausedRef.current || !isActiveRef.current) {
        setAdState(isPausedRef.current ? "paused" : "idle");
        return;
      }
      setAdState("loading");
      timeoutRef.current = setTimeout(() => loadAndPlayRef.current(), delayMs);
    }

    const unsubLoaded = rewarded.addAdEventListener(
      GoogleAds.RewardedAdEventType.LOADED,
      () => {
        if (settled) return;
        if (isPausedRef.current || !isActiveRef.current) {
          settled = true;
          cleanup();
          setAdState(isPausedRef.current ? "paused" : "idle");
          return;
        }
        setAdState("playing");
        rewarded.show().catch(() => {
          if (settled) return;
          settled = true;
          cleanup();
          scheduleNext(3000);
        });
      },
    );

    const unsubEarned = rewarded.addAdEventListener(
      GoogleAds.RewardedAdEventType.EARNED_REWARD,
      () => {
        recordWatchRef.current({ slotId: REWARDED_AD_ID, durationSec: null });
        setErrorCount(0);
      },
    );

    const unsubClosed = rewarded.addAdEventListener(
      GoogleAds.AdEventType.CLOSED,
      () => {
        if (settled) return;
        settled = true;
        cleanup();
        scheduleNext(1000);
      },
    );

    const unsubError = rewarded.addAdEventListener(
      GoogleAds.AdEventType.ERROR,
      () => {
        if (settled) return;
        settled = true;
        cleanup();
        setErrorCount((prev) => {
          const next = prev + 1;
          if (next >= 3) {
            setAdState("error");
          } else {
            scheduleNext(3000);
          }
          return next;
        });
      },
    );

    function cleanup() {
      unsubLoaded();
      unsubEarned();
      unsubClosed();
      unsubError();
      cleanupRef.current = null;
    }

    cleanupRef.current = cleanup;

    // 超时保护：8 秒内没有任何回调，当作加载失败处理
    timeoutRef.current = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        setErrorCount((prev) => {
          const next = prev + 1;
          if (next >= 3) {
            setAdState("error");
          } else {
            scheduleNext(3000);
          }
          return next;
        });
      }
    }, 8000);

    rewarded.load();
  };

  // 进入页面自动开始
  useEffect(() => {
    isActiveRef.current = true;
    if (!isPausedRef.current) {
      loadAndPlayRef.current();
    }
    return () => {
      isActiveRef.current = false;
      cleanupRef.current?.();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // 防止卡在 idle：未暂停时自动重新加载
  useEffect(() => {
    if (adState === "idle" && !isPausedRef.current && isActiveRef.current) {
      timeoutRef.current = setTimeout(() => loadAndPlayRef.current(), 1000);
    }
  }, [adState]);

  // 用 ref 跟踪 adState，避免 AppState effect 频繁重挂
  const adStateRef = useRef(adState);
  adStateRef.current = adState;

  // 后台/前台切换（只挂载一次）
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        isActiveRef.current = true;
        if (!isPausedRef.current && adStateRef.current !== "playing") {
          loadAndPlayRef.current();
        }
      } else {
        isActiveRef.current = false;
      }
    });
    return () => sub.remove();
  }, []);

  const handlePauseResume = () => {
    if (isPausedRef.current) {
      isPausedRef.current = false;
      loadAndPlayRef.current();
    } else {
      isPausedRef.current = true;
      cleanupRef.current?.();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setAdState("paused");
    }
  };

  if (isPro) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" backgroundColor={colors.cream} />
        <View style={styles.header}>
          <AppText size="5xl" weight="bold" color={colors.text}>
            会员
          </AppText>
        </View>
        <View style={styles.adContainer}>
          <View style={styles.adCenter}>
            <AppText size="3xl">👑</AppText>
            <AppText
              size="xl"
              weight="medium"
              color={colors.text}
              style={styles.adText}
            >
              {proStatus.is_trial ? "试用中" : "Pro 会员"}
            </AppText>
            <AppText size="base" color={colors.textLight} style={styles.adText}>
              {proStatus.is_trial
                ? `免费试用剩余 ${proStatus.trial_days_left} 天`
                : proStatus.pro_expires_at?.startsWith("9999")
                  ? "永久会员，感谢支持！"
                  : `有效期至 ${proStatus.pro_expires_at?.slice(0, 10) ?? ""}`}
            </AppText>
          </View>
        </View>
        <View style={styles.bottomSection}>
          <AppText size="lg" color={colors.textLight} style={styles.tip}>
            所有高级功能已解锁，尽情使用语音记账、小票识别等功能吧。
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" backgroundColor={colors.cream} />

      {/* Header */}
      <View style={styles.header}>
        <AppText size="5xl" weight="bold" color={colors.text}>
          收益
        </AppText>
        <View style={styles.headerRight}>
          <AppText size="base" color={colors.textLight}>
            累计观看
          </AppText>
          <View style={styles.countBadge}>
            <AppText size="lg" weight="bold" color={colors.white}>
              {watchCount}
            </AppText>
          </View>
        </View>
      </View>

      {/* 广告播放区域 */}
      <View style={styles.adContainer}>
        {adState === "loading" && (
          <View style={styles.adCenter}>
            <AppText size="3xl">🎬</AppText>
            <AppText size="xl" color={colors.textLight} style={styles.adText}>
              加载中...
            </AppText>
          </View>
        )}
        {adState === "playing" && (
          <View style={styles.adCenter}>
            <AppText size="3xl">▶️</AppText>
            <AppText size="xl" color={colors.textLight} style={styles.adText}>
              广告播放中...
            </AppText>
          </View>
        )}
        {adState === "paused" && (
          <View style={styles.adCenter}>
            <AppText size="3xl">⏸️</AppText>
            <AppText size="xl" color={colors.textLight} style={styles.adText}>
              已暂停
            </AppText>
            <AppText
              size="base"
              color={colors.textLighter}
              style={styles.adText}
            >
              点击下方按钮继续
            </AppText>
          </View>
        )}
        {adState === "error" && (
          <View style={styles.adCenter}>
            <AppText size="3xl">😴</AppText>
            <AppText size="xl" color={colors.textLight} style={styles.adText}>
              暂无广告，稍后再试
            </AppText>
            <TouchableOpacity
              style={styles.retryBtn}
              activeOpacity={0.7}
              onPress={() => {
                setErrorCount(0);
                isPausedRef.current = false;
                loadAndPlayRef.current();
              }}
            >
              <AppText size="lg" weight="medium" color={colors.sage}>
                重试
              </AppText>
            </TouchableOpacity>
          </View>
        )}
        {adState === "idle" && (
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
          <AppText
            size="lg"
            weight="medium"
            color={colors.text}
            style={{ marginBottom: 8 }}
          >
            下一条广告奖励
          </AppText>
          <View style={styles.rewardTags}>
            {nextRewards.map((r, i) => {
              const meta = FEATURE_META[r.feature];
              const isFirst = i === 0;
              return (
                <View
                  key={r.feature}
                  style={{ flexDirection: "row", alignItems: "center" }}
                >
                  {i > 0 && (
                    <AppText size="sm" color={colors.textLighter}>
                      {" "}
                      →{" "}
                    </AppText>
                  )}
                  <View style={isFirst ? styles.rewardTagActive : undefined}>
                    <AppText
                      size="sm"
                      color={isFirst ? colors.sage : colors.textLight}
                    >
                      {meta.icon} {meta.label} +{r.amount}天
                    </AppText>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* 控制按钮 */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[
              styles.controlBtn,
              isPaused(adState) && styles.controlBtnActive,
            ]}
            activeOpacity={0.7}
            onPress={handlePauseResume}
          >
            <AppText
              size="lg"
              weight="medium"
              color={isPaused(adState) ? colors.white : colors.text}
            >
              {isPaused(adState) ? "▶ 开始" : "⏸ 暂停"}
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlBtn}
            activeOpacity={0.7}
            onPress={() => router.push("/ad-rewards")}
          >
            <AppText size="lg" weight="medium" color={colors.text}>
              📋 我的权益
            </AppText>
          </TouchableOpacity>
        </View>

        {/* 说明文字 */}
        <AppText size="lg" color={colors.textLight} style={styles.tip}>
          点击"开始"后将自动播放广告。每条广告播放完毕，手动关闭后会自动加载下一条，如此循环往复，持续累积你的权益。
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  countBadge: {
    backgroundColor: colors.sage,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  adContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    ...shadows.md,
    justifyContent: "center",
    alignItems: "center",
  },
  adCenter: { alignItems: "center", gap: 12 },
  adText: { textAlign: "center" },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.sage,
  },
  bottomSection: { paddingHorizontal: 20, paddingBottom: 100 },
  rewardCard: { marginBottom: 12 },
  rewardTags: { flexDirection: "row", alignItems: "center", gap: 2 },
  rewardTagActive: {
    backgroundColor: colors.sagePale,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  controls: { flexDirection: "row", gap: 12 },
  controlBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    alignItems: "center",
    ...shadows.sm,
  },
  controlBtnActive: { backgroundColor: colors.sage },
  tip: {
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 12,
    lineHeight: 20,
  },
});

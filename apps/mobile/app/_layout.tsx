import { Stack, router } from "expo-router";
import { useCallback, useEffect, useState, useRef } from "react";
import { Platform, View, Text, AppState } from "react-native";
import { AppOpenAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { useEntitlementDecay } from '../hooks/useEntitlementDecay';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as SQLite from "expo-sqlite";
import { useAuth } from "../hooks/useAuth";
import { initDatabase } from "@/lib/db";
import { OfflineContext } from "@/lib/offline-context";

// 动态加载 expo-notifications（Expo Go 中不可用，静默降级）
let Notifications: typeof import("expo-notifications") | null = null;
try {
  Notifications = require("expo-notifications");
} catch {}

// 前台收到通知时的行为
try {
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch {}

// AdMob 开屏广告配置（__DEV__ 时使用测试 ID）
const APP_OPEN_AD_ID = __DEV__ ? TestIds.APP_OPEN : 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyyyyyy';
const SPLASH_MIN_INTERVAL_MS = 30_000; // 两次开屏广告最小间隔 30 秒

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
});

export default function RootLayout() {
  const { session, loading } = useAuth();
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);

  useEffect(() => {
    initDatabase().then(setDb);

    // 请求通知权限 + 设置 Android channel
    async function setupNotifications() {
      if (!Notifications) return;
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("reminder", {
            name: "记账提醒",
            importance: Notifications.AndroidImportance.HIGH,
            sound: "default",
          });
        }
        await Notifications.requestPermissionsAsync();
      } catch {}
    }
    setupNotifications();
  }, []);

  useEffect(() => {
    if (!loading && !session) router.replace("/(auth)/login");
  }, [session, loading]);

  // === AdMob 开屏广告 ===
  const lastSplashTime = useRef(0);

  // 加载并展示开屏广告
  const tryShowSplash = useCallback(() => {
    // TODO: Pro 用户检查
    const now = Date.now();
    if (now - lastSplashTime.current < SPLASH_MIN_INTERVAL_MS) return;
    lastSplashTime.current = now;

    const appOpenAd = AppOpenAd.createForAdRequest(APP_OPEN_AD_ID);
    const unsubLoaded = appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
      appOpenAd.show();
    });
    const unsubError = appOpenAd.addAdEventListener(AdEventType.ERROR, () => {
      // 开屏失败静默忽略
      unsubLoaded();
      unsubError();
    });
    const unsubClosed = appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
      unsubLoaded();
      unsubError();
      unsubClosed();
    });
    appOpenAd.load();
  }, []);

  // 首次启动 + 后台恢复时展示开屏
  useEffect(() => {
    tryShowSplash();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        tryShowSplash();
      }
    });
    return () => subscription.remove();
  }, [tryShowSplash]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F5F5" }}>
        <Text style={{ color: "#2D9B83", fontSize: 28, fontWeight: "800" }}>CoCo</Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineContext.Provider value={{ db }}>
        <EntitlementDecayRunner />
        <Stack screenOptions={{ headerShown: false }} />
      </OfflineContext.Provider>
    </QueryClientProvider>
  );
}

/** 权益衰减必须在 QueryClientProvider + OfflineContext 内部运行 */
function EntitlementDecayRunner() {
  useEntitlementDecay();
  return null;
}

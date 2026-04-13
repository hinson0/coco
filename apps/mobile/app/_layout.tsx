import { initDatabase, migrateNullUserData } from "@/lib/db";
import { OfflineContext } from "@/lib/offline-context";
import { push } from "@/lib/sync/sync-service";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import type * as SQLite from "expo-sqlite";
import { useEffect, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";

import { AuthProvider, useAuth } from "../hooks/useAuth";
import { useAutoBookkeeping } from "../hooks/useAutoBookkeeping";
import { useEntitlementDecay } from "../hooks/useEntitlementDecay";
import { PendingConfirmOverlay } from "../components/auto-bookkeeping/PendingConfirmOverlay";

let GoogleAds: typeof import("react-native-google-mobile-ads") | null = null;
try {
  GoogleAds = require("react-native-google-mobile-ads");
} catch {}

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
const APP_OPEN_AD_ID = __DEV__
  ? (GoogleAds?.TestIds.APP_OPEN ?? "")
  : "ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyyyyyy";
const SPLASH_MIN_INTERVAL_MS = 30_000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
});

function AppContent() {
  const { isAuthenticated, user, loading } = useAuth();
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);

  useEffect(() => {
    initDatabase().then(setDb);

    async function setupNotifications() {
      if (!Notifications) return;
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("reminder", {
            name: "记账提醒",
            importance: Notifications.AndroidImportance.HIGH,
            sound: "default",
          });
          await Notifications.setNotificationChannelAsync("auto-bookkeeping", {
            name: "自动记账",
            importance: Notifications.AndroidImportance.HIGH,
            sound: "default",
          });
        }
        await Notifications.requestPermissionsAsync();
      } catch {}
    }
    setupNotifications();
  }, []);

  // 用户登录后，迁移 NULL 数据
  useEffect(() => {
    if (db && user?.id) {
      migrateNullUserData(db, user.id);
    }
  }, [db, user?.id]);

  // TODO: 暂时跳过登录，测试广告功能
  // useEffect(() => {
  //   if (!loading && !isAuthenticated) router.replace("/(auth)/login");
  // }, [isAuthenticated, loading]);

  // === AdMob 开屏广告（已暂停，保留代码以备恢复） ===
  // const lastSplashTime = useRef(0);
  // const tryShowSplash = useCallback(() => {
  //   if (!GoogleAds) return;
  //   const now = Date.now();
  //   if (now - lastSplashTime.current < SPLASH_MIN_INTERVAL_MS) return;
  //   lastSplashTime.current = now;
  //   const appOpenAd = GoogleAds.AppOpenAd.createForAdRequest(APP_OPEN_AD_ID);
  //   function cleanupAll() { unsubLoaded(); unsubError(); unsubClosed(); }
  //   const unsubLoaded = appOpenAd.addAdEventListener(GoogleAds.AdEventType.LOADED, () => { cleanupAll(); appOpenAd.show(); });
  //   const unsubError = appOpenAd.addAdEventListener(GoogleAds.AdEventType.ERROR, () => { cleanupAll(); });
  //   const unsubClosed = appOpenAd.addAdEventListener(GoogleAds.AdEventType.CLOSED, () => { cleanupAll(); });
  //   appOpenAd.load();
  // }, []);
  // const wasBackgroundRef = useRef(false);
  // useEffect(() => {
  //   tryShowSplash();
  //   const subscription = AppState.addEventListener("change", (nextState) => {
  //     if (nextState === "background") { wasBackgroundRef.current = true; }
  //     else if (nextState === "active" && wasBackgroundRef.current) { wasBackgroundRef.current = false; tryShowSplash(); }
  //   });
  //   return () => subscription.remove();
  // }, [tryShowSplash]);

  // 每 30s 静默 push（仅 App 前台有效）
  useEffect(() => {
    if (!db || !user?.id) return;
    const interval = setInterval(() => {
      push(db, user.id).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, [db, user?.id]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F5F5F5",
        }}
      >
        <Text style={{ color: "#2D9B83", fontSize: 28, fontWeight: "800" }}>
          CoCo
        </Text>
      </View>
    );
  }

  return (
    <OfflineContext.Provider value={{ db, userId: user?.id ?? null }}>
      <EntitlementDecayRunner />
      <AutoBookkeepingRunner />
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
      <PendingConfirmOverlay />
    </OfflineContext.Provider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </AuthProvider>
  );
}

/** 权益衰减必须在 QueryClientProvider + OfflineContext 内部运行 */
function EntitlementDecayRunner() {
  useEntitlementDecay();
  return null;
}

/** 自动记账通知监听 */
function AutoBookkeepingRunner() {
  useAutoBookkeeping();
  return null;
}

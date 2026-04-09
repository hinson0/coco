import { initDatabase, migrateNullUserData } from "@/lib/db";
import { OfflineContext } from "@/lib/offline-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import type * as SQLite from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";
import { AppOpenAd, AdEventType, TestIds } from "react-native-google-mobile-ads";
import { useEntitlementDecay } from "../hooks/useEntitlementDecay";
import { AuthProvider, useAuth } from "../hooks/useAuth";

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
  ? TestIds.APP_OPEN
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

  // === AdMob 开屏广告 ===
  const lastSplashTime = useRef(0);

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

  useEffect(() => {
    tryShowSplash();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        tryShowSplash();
      }
    });
    return () => subscription.remove();
  }, [tryShowSplash]);

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
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
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

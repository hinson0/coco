import { initDatabase, migrateNullUserData } from "@/lib/db";
import { OfflineContext } from "@/lib/offline-context";
import { push } from "@/lib/sync/sync-service";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import type * as SQLite from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";
import { init as initMangoAd, showSplashAd } from "expo-mango-ad";
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

// 芒果聚合广告配置
// TODO: 替换为芒果后台获取的真实 ID
const MANGO_APP_ID = __DEV__ ? "test_app_id" : "YOUR_MANGO_APP_ID";
const SPLASH_SLOT_ID = __DEV__ ? "test_splash_slot" : "YOUR_SPLASH_SLOT_ID";
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

  // === 芒果聚合广告：SDK 初始化 + 开屏广告 ===
  const mangoInitRef = useRef(false);
  const lastSplashTime = useRef(0);

  const tryShowSplash = useCallback(async () => {
    // TODO: Pro 用户检查
    const now = Date.now();
    if (now - lastSplashTime.current < SPLASH_MIN_INTERVAL_MS) return;
    lastSplashTime.current = now;

    try {
      if (!mangoInitRef.current) {
        await initMangoAd({ appId: MANGO_APP_ID });
        mangoInitRef.current = true;
      }
      await showSplashAd(SPLASH_SLOT_ID);
    } catch {
      // 开屏广告加载失败静默忽略，不影响用户进入 App
    }
  }, []);

  // 只在真正从后台恢复时弹开屏广告（非广告关闭导致的 active）
  const wasBackgroundRef = useRef(false);
  useEffect(() => {
    tryShowSplash(); // 冷启动
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background") {
        wasBackgroundRef.current = true;
      } else if (nextState === "active" && wasBackgroundRef.current) {
        wasBackgroundRef.current = false;
        tryShowSplash();
      }
    });
    return () => subscription.remove();
  }, [tryShowSplash]);

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

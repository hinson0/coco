import { Stack, router } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { Platform, View, Text, AppState } from "react-native";
import * as ExpoPangle from '../../modules/expo-pangle/src/ExpoPangle';
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

// 穿山甲配置 — 替换为实际的 App ID 和广告位 ID
const PANGLE_APP_ID = 'YOUR_APP_ID';
const SPLASH_SLOT_ID = 'YOUR_SPLASH_SLOT';
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

  // === 穿山甲初始化 + 开屏广告 ===
  const lastSplashTime = useRef(0);
  const pangleReady = useRef(false);

  // 权益衰减（放在根布局）
  useEntitlementDecay();

  // 初始化穿山甲 SDK + 首次开屏
  useEffect(() => {
    async function initPangle() {
      try {
        await ExpoPangle.init({ appId: PANGLE_APP_ID });
        pangleReady.current = true;
        await tryShowSplash();
      } catch (err) {
        console.error('[Pangle] init failed:', err);
      }
    }
    initPangle();
  }, []);

  // 后台恢复时开屏广告
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && pangleReady.current) {
        tryShowSplash();
      }
    });
    return () => subscription.remove();
  }, []);

  async function tryShowSplash() {
    // TODO: Pro 用户检查 — 后续实现 Pro 系统后补全
    const now = Date.now();
    if (now - lastSplashTime.current < SPLASH_MIN_INTERVAL_MS) return;
    lastSplashTime.current = now;
    try {
      await ExpoPangle.showSplashAd(SPLASH_SLOT_ID);
    } catch {
      // 开屏失败静默忽略
    }
  }

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
        <Stack screenOptions={{ headerShown: false }} />
      </OfflineContext.Provider>
    </QueryClientProvider>
  );
}

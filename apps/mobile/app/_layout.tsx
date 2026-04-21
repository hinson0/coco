import { initDatabase, migrateNullUserData } from "@/lib/db";
import { OfflineContext } from "@/lib/offline-context";
import { invalidateSyncedQueries } from "@/lib/queryKeys";
import { pull, push } from "@/lib/sync/sync-service";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import type * as SQLite from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";

// 阻止 splash 自动消失，等 App 完全准备好再手动隐藏
SplashScreen.preventAutoHideAsync().catch(() => {});

import { AuthProvider, useAuth } from "../hooks/useAuth";
import { getAuthRedirectTarget } from "../lib/auth-redirect";
import { useAutoBookkeeping } from "../hooks/useAutoBookkeeping";
import { useEntitlementDecay } from "../hooks/useEntitlementDecay";

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
});

function AppContent() {
  const { isAuthenticated, user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
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
            sound: null,
          });
          await Notifications.setNotificationChannelAsync("auto-bookkeeping", {
            name: "自动记账",
            importance: Notifications.AndroidImportance.HIGH,
            sound: null,
          });
        }
        await Notifications.requestPermissionsAsync();
      } catch {}
    }
    setupNotifications();
  }, []);

  // 用户登录后：先迁移 NULL user_id 旧数据，再从云端拉一次历史。
  // 每步完成后主动 invalidate 相关 query，否则 staleTime: Infinity 下
  // 早于迁移/拉取完成的 UI 查询会把空结果永久缓存，导致首次进入 AI 页看不到旧消息。
  useEffect(() => {
    if (!db || !user?.id) return;
    const userId = user.id;
    let cancelled = false;

    (async () => {
      try {
        await migrateNullUserData(db, userId);
      } catch (err: unknown) {
        // 如果 NULL 数据迁移失败，后续 pull 的 LWW upsert 会把远端版本写进来，
        // 而本地 user_id IS NULL 的记录依然不属于任何用户，会被 UI 查询永久忽略
        // （相当于数据丢失）。所以 migration 失败时不继续 pull，等下次启动重试。
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[Migration] migrateNullUserData 失败，跳过 pull:", msg);
        return;
      }
      if (cancelled) return;
      invalidateSyncedQueries(queryClient);

      try {
        await pull(db, userId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[Sync] 启动 pull 失败:", msg);
        return;
      }
      if (cancelled) return;
      invalidateSyncedQueries(queryClient);
    })();

    return () => {
      cancelled = true;
    };
  }, [db, user?.id]);

  // 自动 push：30s 基准间隔，失败时指数退避（60s → 120s → 240s），成功后恢复 30s
  useEffect(() => {
    if (!db || !user?.id) return;
    let timer: ReturnType<typeof setTimeout>;
    let delay = 30_000;
    let cancelled = false;

    function schedule() {
      timer = setTimeout(async () => {
        if (cancelled) return;
        try {
          await push(db!, user!.id);
          delay = 30_000; // 成功 → 恢复基准间隔
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[Sync] push 失败 (下次 ${(delay * 2) / 1000}s 后重试):`,
            msg,
          );
          delay = Math.min(delay * 2, 240_000); // 指数退避，上限 4 分钟
        }
        if (!cancelled) schedule();
      }, delay);
    }

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [db, user?.id]);

  // App 未准备好时，return null 让原生 splash 持续显示
  const isReady = !loading && db !== null;

  // 认证路由守卫：未登录时跳转登录页，已登录时离开 auth 页面
  useEffect(() => {
    const target = getAuthRedirectTarget(
      isAuthenticated,
      isReady,
      segments[0] as string | undefined,
    );
    if (target) router.replace(target as Href);
  }, [isAuthenticated, isReady, segments, router]);

  const onLayoutRootView = useCallback(async () => {
    if (isReady) {
      // 延迟 1 帧再隐藏，防止掉帧
      await new Promise(requestAnimationFrame);
      await SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <OfflineContext.Provider value={{ db, userId: user?.id ?? null }}>
        <EntitlementDecayRunner />
        <AutoBookkeepingRunner />
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
      </OfflineContext.Provider>
    </View>
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

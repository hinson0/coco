import { initDatabase, migrateNullUserData } from "@/lib/db";
import { OfflineContext } from "@/lib/offline-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import type * as SQLite from "expo-sqlite";
import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
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

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/(auth)/login");
  }, [isAuthenticated, loading]);

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

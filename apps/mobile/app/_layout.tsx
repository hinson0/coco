import { Slot, router } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SQLite from "expo-sqlite";
import { useAuth } from "../hooks/useAuth";
import { initQueue, resetSyncingToPending } from "@/lib/queue/operation-queue";
import { createSyncManager, type SyncManager } from "@/lib/sync/sync-manager";
import { OfflineContext } from "@/lib/offline-context";
import { useSync } from "@/hooks/useSync";
import { apiFetch } from "@/lib/api";

const queryClient = new QueryClient();

export default function RootLayout() {
  const { session, loading } = useAuth();
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [syncManager, setSyncManager] = useState<SyncManager | null>(null);

  useEffect(() => {
    async function initDatabase() {
      const database = await SQLite.openDatabaseAsync("coco-queue");
      await initQueue(database);
      await resetSyncingToPending(database);
      setDb(database);

      const manager = createSyncManager({
        db: database,
        apiFetch,
        invalidateQueries: async (keys) => {
          await Promise.all(
            keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))
          );
        },
        isOnline: () => true,
      });
      setSyncManager(manager);
    }

    initDatabase();
  }, []);

  useSync(syncManager);

  useEffect(() => {
    if (!loading && !session) router.replace("/(auth)/login");
  }, [session, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F5F5" }}>
        <Text style={{ color: "#2D9B83", fontSize: 28, fontWeight: "800" }}>CoCo</Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineContext.Provider value={{ db, syncManager }}>
        <Slot />
      </OfflineContext.Provider>
    </QueryClientProvider>
  );
}

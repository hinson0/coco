import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as SQLite from "expo-sqlite";
import { useAuth } from "../hooks/useAuth";
import { initDatabase } from "@/lib/db";
import { OfflineContext } from "@/lib/offline-context";

const queryClient = new QueryClient();

export default function RootLayout() {
  const { session, loading } = useAuth();
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);

  useEffect(() => {
    initDatabase().then(setDb);
  }, []);

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
      <OfflineContext.Provider value={{ db }}>
        <Stack screenOptions={{ headerShown: false }} />
      </OfflineContext.Provider>
    </QueryClientProvider>
  );
}

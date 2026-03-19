import { Slot, router } from "expo-router";
import { useEffect } from "react";
import { View, Text } from "react-native";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../hooks/useAuth";

const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;

const PERSISTED_KEY_PREFIXES = [
  "chat-messages",
  "transactions",
  "budgets",
  "categories",
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: SEVEN_DAYS,
    },
  },
});

const MAX_CHAT_PAGES_TO_PERSIST = 3;

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  serialize: (data) => {
    const client = data as any;
    if (client?.clientState?.queries) {
      client.clientState.queries = client.clientState.queries.map((q: any) => {
        if (q.queryKey?.[0] === "chat-messages" && q.state?.data?.pages) {
          return {
            ...q,
            state: {
              ...q.state,
              data: {
                ...q.state.data,
                pages: q.state.data.pages.slice(0, MAX_CHAT_PAGES_TO_PERSIST),
                pageParams: q.state.data.pageParams.slice(0, MAX_CHAT_PAGES_TO_PERSIST),
              },
            },
          };
        }
        return q;
      });
    }
    return JSON.stringify(data);
  },
});

export default function RootLayout() {
  const { session, loading } = useAuth();

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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: SEVEN_DAYS,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey[0];
            return typeof key === "string" && PERSISTED_KEY_PREFIXES.includes(key);
          },
        },
      }}
    >
      <Slot />
    </PersistQueryClientProvider>
  );
}

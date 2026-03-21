// apps/mobile/lib/offline-context.ts
import { createContext, useContext } from "react";
import type * as SQLite from "expo-sqlite";
import type { SyncManager } from "@/lib/sync/sync-manager";

interface OfflineContextValue {
  readonly db: SQLite.SQLiteDatabase | null;
  readonly syncManager: SyncManager | null;
}

export const OfflineContext = createContext<OfflineContextValue>({
  db: null,
  syncManager: null,
});

export function useOfflineContext(): OfflineContextValue {
  return useContext(OfflineContext);
}

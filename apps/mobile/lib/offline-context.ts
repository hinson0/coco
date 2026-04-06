// apps/mobile/lib/offline-context.ts
import { createContext, useContext } from "react";
import type * as SQLite from "expo-sqlite";

interface OfflineContextValue {
  readonly db: SQLite.SQLiteDatabase | null;
}

export const OfflineContext = createContext<OfflineContextValue>({
  db: null,
});

export function useOfflineContext(): OfflineContextValue {
  return useContext(OfflineContext);
}

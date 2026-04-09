// apps/mobile/lib/offline-context.ts
import { createContext, useContext } from "react";
import type * as SQLite from "expo-sqlite";

interface OfflineContextValue {
  readonly db: SQLite.SQLiteDatabase | null;
  readonly userId: string | null;
}

export const OfflineContext = createContext<OfflineContextValue>({
  db: null,
  userId: null,
});

export function useOfflineContext(): OfflineContextValue {
  return useContext(OfflineContext);
}

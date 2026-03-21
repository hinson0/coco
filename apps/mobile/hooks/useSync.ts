// apps/mobile/hooks/useSync.ts
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import type { SyncManager } from "@/lib/sync/sync-manager";

export function useSync(manager: SyncManager | null): void {
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!manager) return;

    manager.sync();

    const unsubNet = NetInfo.addEventListener((state) => {
      if (state.isConnected && wasOffline.current) {
        manager.sync();
      }
      wasOffline.current = !state.isConnected;
    });

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        manager.sync();
      }
    };
    const subAppState = AppState.addEventListener("change", handleAppState);

    return () => {
      unsubNet();
      subAppState.remove();
    };
  }, [manager]);
}

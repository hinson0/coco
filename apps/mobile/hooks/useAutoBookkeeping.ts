import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useOfflineContext } from "@/lib/offline-context";
import { parseNotification } from "@/lib/auto-bookkeeping/parser";
import { isDuplicate } from "@/lib/auto-bookkeeping/dedup";
import {
  addPending,
  getRecentForDedup,
} from "@/lib/auto-bookkeeping/pending-queue";
import { useQueryClient } from "@tanstack/react-query";

let _nativeModule:
  | typeof import("../../modules/expo-auto-bookkeeping/src/ExpoAutoBookkeeping")
  | null = null;

function getNativeModule() {
  if (_nativeModule !== undefined && _nativeModule !== null)
    return _nativeModule;
  if (Platform.OS !== "android") return null;
  try {
    _nativeModule =
      require("../../modules/expo-auto-bookkeeping/src/ExpoAutoBookkeeping") as typeof import("../../modules/expo-auto-bookkeeping/src/ExpoAutoBookkeeping");
    return _nativeModule;
  } catch {
    _nativeModule = null;
    return null;
  }
}

export function useAutoBookkeeping() {
  const { db, userId } = useOfflineContext();
  const qc = useQueryClient();
  const dbRef = useRef(db);
  const userIdRef = useRef(userId);

  useEffect(() => {
    dbRef.current = db;
    userIdRef.current = userId;
  }, [db, userId]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const mod = getNativeModule();
    if (!mod) return;

    const subscription = mod.onNotificationReceived(async (event) => {
      const currentDb = dbRef.current;
      const currentUserId = userIdRef.current;
      if (!currentDb || !currentUserId) return;

      const parsed = parseNotification(
        event.packageName,
        event.title,
        event.text,
      );
      if (!parsed) return;

      const recentItems = await getRecentForDedup(currentDb, currentUserId);
      if (
        isDuplicate(
          {
            amount: parsed.amount,
            source: parsed.source,
            timestamp: event.timestamp,
          },
          recentItems,
        )
      ) {
        return;
      }

      await addPending(currentDb, currentUserId, parsed, event.timestamp);
      qc.invalidateQueries({ queryKey: ["pending-notifications"] });

      const sourceLabel = parsed.source === "wechat" ? "微信支付" : "支付宝";
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "检测到一笔消费",
          body: `${sourceLabel} ¥${parsed.amount.toFixed(2)}，点击确认记账`,
          data: { type: "auto-bookkeeping" },
        },
        trigger: null,
      });
    });

    return () => {
      subscription.remove();
    };
  }, [qc]);
}

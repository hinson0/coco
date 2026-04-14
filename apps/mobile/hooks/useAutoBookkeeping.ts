import { useEffect, useRef, useCallback } from "react";
import { Alert, AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useOfflineContext } from "@/lib/offline-context";
import { parseNotification } from "@/lib/auto-bookkeeping/parser";
import { isDuplicate } from "@/lib/auto-bookkeeping/dedup";
import {
  addPending,
  getRecentForDedup,
} from "@/lib/auto-bookkeeping/pending-queue";
import { useQueryClient } from "@tanstack/react-query";
import { PENDING_QUERY_KEY } from "./usePendingNotifications";
import type { NotificationEvent } from "../../../modules/expo-auto-bookkeeping/src/ExpoAutoBookkeeping.types";

let _nativeModule:
  | typeof import("../../../modules/expo-auto-bookkeeping/src/ExpoAutoBookkeeping")
  | null = null;

function getNativeModule() {
  if (_nativeModule !== undefined && _nativeModule !== null)
    return _nativeModule;
  if (Platform.OS !== "android") return null;
  try {
    _nativeModule =
      require("../../../modules/expo-auto-bookkeeping/src/ExpoAutoBookkeeping") as typeof import("../../../modules/expo-auto-bookkeeping/src/ExpoAutoBookkeeping");
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
  // 串行锁：防止并发 check-then-insert 竞态
  const processingLock = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    dbRef.current = db;
    userIdRef.current = userId;
  }, [db, userId]);

  const processNotification = useCallback(
    (event: NotificationEvent) => {
      processingLock.current = processingLock.current.then(async () => {
        const currentDb = dbRef.current;
        const currentUserId = userIdRef.current;
        if (!currentDb || !currentUserId) return;

        const parsed = parseNotification(
          event.packageName,
          event.title,
          event.text,
        );
        if (!parsed) return;

        const recentItems = await getRecentForDedup(
          currentDb,
          currentUserId,
          event.timestamp,
        );
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
        qc.invalidateQueries({ queryKey: [PENDING_QUERY_KEY] });

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
      return processingLock.current;
    },
    [qc],
  );

  // 从原生缓冲区拉取通知（解决后台时 EventEmitter 不工作的问题）
  const flushBuffer = useCallback(async () => {
    const mod = getNativeModule();
    if (!mod) return;

    const buffered = mod.getAndClearBuffer();
    if (buffered.length === 0) return;

    for (const event of buffered) {
      await processNotification(event);
    }
  }, [processNotification]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    // App 启动时拉取一次
    flushBuffer();

    // App 从后台回到前台时拉取
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        flushBuffer();
      }
    });

    // 同时监听实时事件（App 在前台时）
    const mod = getNativeModule();
    const eventSub = mod?.onNotificationReceived(async (event) => {
      await processNotification(event);
    });

    return () => {
      subscription.remove();
      eventSub?.remove();
    };
  }, [flushBuffer, processNotification]);
}

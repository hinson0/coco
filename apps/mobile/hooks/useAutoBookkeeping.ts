import { useEffect, useRef, useCallback } from "react";
import { AppState, Platform } from "react-native";
import { useOfflineContext } from "@/lib/offline-context";
import { QK } from "@/lib/queryKeys";
import { parseNotification } from "@/lib/auto-bookkeeping/parser";
import { addPending, getRecentForDedup } from "@/lib/auto-bookkeeping/pending-queue";
import { isDuplicate } from "@/lib/auto-bookkeeping/dedup";
import { useQueryClient } from "@tanstack/react-query";
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
  const processingLock = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    dbRef.current = db;
    userIdRef.current = userId;
  }, [db, userId]);

  const processNotification = useCallback(
    (event: NotificationEvent) => {
      processingLock.current = processingLock.current
        .then(async () => {
          const currentDb = dbRef.current;
          const currentUserId = userIdRef.current;
          if (!currentDb || !currentUserId) return;

          // 1. 解析通知
          const parsed = parseNotification(
            event.packageName,
            event.title,
            event.text,
          );
          if (!parsed) return;

          // 2. 去重：基于 pending_notifications 表，使用 dedup.ts 的逻辑
          // 包含 rawText 比较，避免同金额不同商户的交易被误判为重复
          const recentItems = await getRecentForDedup(
            currentDb,
            currentUserId,
            event.timestamp,
          );
          const incoming = {
            amount: parsed.amount,
            source: parsed.source,
            timestamp: event.timestamp ?? Date.now(),
            rawText: parsed.rawText,
          };
          if (isDuplicate(incoming, recentItems)) {
            console.debug(
              "[AutoBookkeeping] 去重拦截：相同金额来源已存在待确认队列中",
              incoming,
            );
            return;
          }

          // 3. 添加到 pending 队列，等待用户在 PendingConfirmOverlay 中确认
          await addPending(currentDb, currentUserId, parsed, event.timestamp);
          console.debug("[AutoBookkeeping] 已添加到待确认队列:", parsed);

          // 4. 刷新 pending 查询，触发 PendingConfirmOverlay 弹窗
          qc.invalidateQueries({ queryKey: [QK.pendingNotifications] });
        })
        .catch((err: unknown) => {
          console.error("[AutoBookkeeping] 处理通知失败:", err);
        });
      return processingLock.current;
    },
    [qc],
  );

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

    flushBuffer();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        flushBuffer();
      }
    });

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

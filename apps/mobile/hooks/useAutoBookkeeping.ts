import { useEffect, useRef, useCallback } from "react";
import { AppState, Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { useOfflineContext } from "@/lib/offline-context";
import { parseNotification } from "@/lib/auto-bookkeeping/parser";
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

const DEDUP_WINDOW_MS = 10_000;

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

          const parsed = parseNotification(
            event.packageName,
            event.title,
            event.text,
          );
          if (!parsed) return;

          // 去重：查询最近 10s 内同金额同来源的自动记账交易
          // 用 occurred_at（通知发生时间）而非 created_at（入库时间），
          // 避免 buffer flush 延迟导致去重窗口失效
          const cutoff = new Date(
            (event.timestamp ?? Date.now()) - DEDUP_WINDOW_MS,
          ).toISOString();
          const existing = await currentDb.getFirstAsync<{ id: string }>(
            `SELECT id FROM transactions
           WHERE user_id = ? AND source = 'notification'
             AND amount = ? AND occurred_at > ?
           LIMIT 1`,
            currentUserId,
            parsed.amount,
            cutoff,
          );
          if (existing) return;

          // 查找"购物"分类
          const category = await currentDb.getFirstAsync<{
            id: string;
            name: string;
            icon: string;
          }>(
            `SELECT id, name, icon FROM categories
           WHERE (user_id = ? OR (user_id IS NULL AND is_default = 1))
             AND name = '购物' AND deleted_at IS NULL
           LIMIT 1`,
            currentUserId,
          );
          if (!category) return;
          const categoryId = category.id;

          // 直接创建交易
          const txId = Crypto.randomUUID();
          const now = new Date().toISOString();
          const occurredAt = new Date(
            event.timestamp ?? Date.now(),
          ).toISOString();

          await currentDb.runAsync(
            `INSERT INTO transactions (id, user_id, category_id, amount, type, note, occurred_at, source, raw_input, receipt_url, ai_confidence, created_at, updated_at, account_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'notification', ?, NULL, NULL, ?, ?, NULL)`,
            txId,
            currentUserId,
            categoryId,
            parsed.amount,
            parsed.type,
            "",
            occurredAt,
            event.packageName,
            now,
            now,
          );

          // 创建聊天消息（bill_card）
          const sourceLabel =
            parsed.source === "wechat" ? "微信支付" : "支付宝";
          const msgId = Crypto.randomUUID();
          await currentDb.runAsync(
            `INSERT INTO chat_messages (id, user_id, role, content_type, content, transaction_id, created_at, updated_at)
           VALUES (?, ?, 'assistant', 'bill_card', ?, ?, ?, ?)`,
            msgId,
            currentUserId,
            JSON.stringify({
              id: txId,
              amount: parsed.amount,
              type: parsed.type,
              category_id: categoryId,
              note: "",
              source: "notification",
              source_label: sourceLabel,
              raw_input: event.packageName,
              occurred_at: occurredAt,
            }),
            txId,
            now,
            now,
          );

          qc.invalidateQueries({ queryKey: ["transactions"] });
          qc.invalidateQueries({ queryKey: ["chat-messages"] });
          qc.invalidateQueries({ queryKey: ["account-balance"] });
          qc.invalidateQueries({ queryKey: ["total-assets"] });
        })
        .catch((err) => {
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

import type { StreamEvent } from "@coco/shared";
import * as Localization from "expo-localization";
import EventSource from "react-native-sse";

import { getAccessToken, refreshAccessToken } from "./auth";
import { API_BASE } from "./config";

export type { StreamEvent, StreamTransaction } from "@coco/shared";

export interface StreamCallbacks {
  onEvent: (event: StreamEvent) => void | Promise<void>;
  onDone: () => void;
  onError: (message: string) => void;
}

function buildHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-Timezone": Localization.getCalendars()[0]?.timeZone ?? "Asia/Shanghai",
    Accept: "text/event-stream",
  };
}

export interface StreamHandle {
  close: () => void;
}

export async function openStream(
  path: string,
  body: object,
  callbacks: StreamCallbacks,
): Promise<StreamHandle> {
  let token = await getAccessToken();
  if (!token) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) throw new Error("Not authenticated");
    token = refreshed;
  }

  const url = `${API_BASE}${path}`;
  const serializedBody = JSON.stringify(body);

  const es = new EventSource(url, {
    method: "POST",
    headers: buildHeaders(token),
    body: serializedBody,
    pollingInterval: 0,
  });

  let closed = false;
  let doneFired = false;

  const finishOk = () => {
    if (doneFired || closed) return;
    doneFired = true;
    es.removeAllEventListeners();
    es.close();
    closed = true;
    callbacks.onDone();
  };

  const finishErr = (message: string) => {
    if (doneFired || closed) return;
    doneFired = true;
    es.removeAllEventListeners();
    es.close();
    closed = true;
    callbacks.onError(message);
  };

  // 用 Promise 链保证 onEvent 串行执行，避免 async 处理器与后续事件乱序
  // （react-native-sse 的 listener 不会 await 回调）。
  let processing: Promise<void> = Promise.resolve();
  // 服务端已完成（见到 [DONE]）但 onEvent Promise 链还没排到 finishOk 时，
  // react-native-sse 底层会因为 TCP 关闭触发 error 事件。若此时 finishErr
  // 抢跑，会让用户误以为"连接异常"而账单其实已入库。用该标志识别并软降级
  // 到 finishOk。
  let doneSeen = false;

  es.addEventListener("message", (event) => {
    const raw = event.data;
    if (!raw) return;
    if (raw === "[DONE]") {
      doneSeen = true;
      processing = processing.then(finishOk).catch(() => finishOk());
      return;
    }
    let parsed: StreamEvent;
    try {
      parsed = JSON.parse(raw) as StreamEvent;
    } catch {
      return; // 忽略无法解析的分片
    }
    processing = processing
      .then(() => callbacks.onEvent(parsed))
      .catch((err) => {
        console.error("[sse] onEvent handler threw:", err);
      });
  });

  es.addEventListener("error", (event) => {
    // [DONE] 已到达，当前 error 一定是服务端正常关闭连接触发的，
    // 等 processing 链排干后走成功路径即可。
    if (doneSeen) {
      processing = processing.then(finishOk).catch(() => finishOk());
      return;
    }
    const message =
      "message" in event && event.message
        ? event.message
        : "连接异常，请稍后再试";
    finishErr(message);
  });

  return {
    close: () => {
      if (closed) return;
      closed = true;
      es.removeAllEventListeners();
      es.close();
    },
  };
}

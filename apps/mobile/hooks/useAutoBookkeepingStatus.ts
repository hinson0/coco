import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { AutoBookkeeping } from "../lib/auto-bookkeeping";

// useFocusEffect 而非 useEffect:stack push 后上层屏幕 unfocus,自动清掉 interval,
// 避免 auto-guide 与 smarter-coco 同时挂载时双倍 JNI 调用
export function useAutoBookkeepingStatus() {
  const [listenerGranted, setListenerGranted] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [channelEnabled, setChannelEnabled] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android" || !AutoBookkeeping) return;
      const check = () => {
        setListenerGranted(AutoBookkeeping!.isPermissionGranted());
        setNotifEnabled(AutoBookkeeping!.areNotificationsEnabled());
        setChannelEnabled(AutoBookkeeping!.isChannelEnabled());
      };
      check();
      const interval = setInterval(check, 3000);
      return () => clearInterval(interval);
    }, []),
  );

  return { listenerGranted, notifEnabled, channelEnabled };
}

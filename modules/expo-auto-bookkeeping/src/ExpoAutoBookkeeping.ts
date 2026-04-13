import { Platform } from "react-native";
import { requireNativeModule, EventEmitter } from "expo-modules-core";
import type { NotificationEvent, ServiceStatus } from "./ExpoAutoBookkeeping.types";

const IS_ANDROID = Platform.OS === "android";

function getNativeModule() {
  if (!IS_ANDROID) return null;
  try {
    return requireNativeModule("ExpoAutoBookkeeping");
  } catch {
    return null;
  }
}

const NativeModule = getNativeModule();
const emitter = NativeModule ? new EventEmitter(NativeModule) : null;

export function isPermissionGranted(): boolean {
  if (!NativeModule) return false;
  return NativeModule.isPermissionGranted();
}

export function openPermissionSettings(): void {
  if (!NativeModule) return;
  NativeModule.openPermissionSettings();
}

export function getServiceStatus(): ServiceStatus {
  if (!NativeModule) {
    return { permissionGranted: false, serviceConnected: false };
  }
  return NativeModule.getServiceStatus();
}

export function onNotificationReceived(
  callback: (event: NotificationEvent) => void,
) {
  if (!emitter) return { remove: () => {} };
  return emitter.addListener("onNotificationReceived", callback);
}

export type { NotificationEvent, ServiceStatus };

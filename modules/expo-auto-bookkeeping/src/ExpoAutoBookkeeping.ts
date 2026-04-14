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

export function areNotificationsEnabled(): boolean {
  if (!NativeModule) return false;
  return NativeModule.areNotificationsEnabled();
}

export function isChannelEnabled(): boolean {
  if (!NativeModule) return false;
  return NativeModule.isChannelEnabled();
}

export function openNotificationSettings(): void {
  if (!NativeModule) return;
  NativeModule.openNotificationSettings();
}

export function openAutoStartSettings(): void {
  if (!NativeModule) return;
  NativeModule.openAutoStartSettings();
}

export function getAndClearBuffer(): NotificationEvent[] {
  if (!NativeModule) return [];
  return NativeModule.getAndClearBuffer();
}

export interface DebugInfo {
  readonly serviceConnected: boolean;
  readonly moduleRegistered: boolean;
  readonly totalNotifications: number;
  readonly watchedNotifications: number;
  readonly localNotifSent: number;
  readonly localNotifError: string;
  readonly lastPkg: string;
  readonly lastTitle: string;
  readonly lastText: string;
}

export function getDebugInfo(): DebugInfo {
  if (!NativeModule) {
    return {
      serviceConnected: false,
      moduleRegistered: false,
      totalNotifications: 0,
      watchedNotifications: 0,
      lastPkg: "",
      lastTitle: "",
      lastText: "",
    };
  }
  return NativeModule.getDebugInfo();
}

export type { NotificationEvent, ServiceStatus };

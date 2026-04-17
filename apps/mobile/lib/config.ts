const url = __DEV__
  ? process.env.EXPO_PUBLIC_API_URL_DEV
  : process.env.EXPO_PUBLIC_API_URL;

if (!url) {
  const missing = __DEV__ ? "EXPO_PUBLIC_API_URL_DEV" : "EXPO_PUBLIC_API_URL";
  throw new Error(`API_BASE 未配置：请在 apps/mobile/.env 设置 ${missing}`);
}

export const API_BASE: string = url;

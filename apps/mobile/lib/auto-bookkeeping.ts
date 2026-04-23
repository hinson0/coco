import { Platform } from "react-native";

let mod:
  | typeof import("../../../modules/expo-auto-bookkeeping/src/ExpoAutoBookkeeping")
  | null = null;
if (Platform.OS === "android") {
  try {
    mod = require("../../../modules/expo-auto-bookkeeping/src/ExpoAutoBookkeeping");
  } catch {}
}

export const AutoBookkeeping = mod;

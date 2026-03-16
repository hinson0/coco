import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

function buildClient(): SupabaseClient {
  // Lazy-import AsyncStorage to avoid "window is not defined" during SSR
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AsyncStorage = require("@react-native-async-storage/async-storage").default;
  return createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true } }
  );
}

let _instance: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_instance) _instance = buildClient();
    return (_instance as any)[prop];
  },
});

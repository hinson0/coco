import * as Localization from "expo-localization";
import { supabase } from "./supabase";

const API_BASE = process.env.EXPO_PUBLIC_API_URL;

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      "X-Timezone": Localization.getCalendars()[0]?.timeZone ?? "Asia/Shanghai",
      ...options?.headers,
    },
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error ?? `HTTP ${response.status}`);
  }
  return json;
}

import * as Localization from "expo-localization";

import { getAccessToken, refreshAccessToken } from "./auth";

const API_BASE = process.env.EXPO_PUBLIC_API_URL;

async function fetchWithToken(
  token: string,
  path: string,
  options?: RequestInit,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Timezone": Localization.getCalendars()[0]?.timeZone ?? "Asia/Shanghai",
      ...options?.headers,
    },
  });
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  let response = await fetchWithToken(token, path, options);

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) throw new Error("Not authenticated");
    response = await fetchWithToken(newToken, path, options);
  }

  const json = await response.json();
  if (!response.ok) throw new Error(json?.error ?? `HTTP ${response.status}`);
  return json;
}

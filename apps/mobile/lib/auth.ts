import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_API_URL;
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_ID_KEY = "user_id";
const USER_EMAIL_KEY = "user_email";
const PRO_STATUS_KEY = "pro_status";

export async function register(email: string, password: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) {
    const data = await resp.json();
    throw new Error(data.detail ?? "Registration failed");
  }
}

export async function login(email: string, password: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) {
    const data = await resp.json();
    throw new Error(data.detail ?? "Login failed");
  }
  const { access_token, refresh_token, pro_status } = await resp.json();
  console.log("[auth] login success, token length:", access_token?.length);
  if (pro_status) {
    await AsyncStorage.setItem(PRO_STATUS_KEY, JSON.stringify(pro_status));
  }

  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, access_token);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
  // 存用户信息：从 JWT payload 解码 user_id，email 直接用登录时的入参
  const payload = JSON.parse(atob(access_token.split(".")[1]));
  await AsyncStorage.setItem(USER_ID_KEY, payload.sub);
  await AsyncStorage.setItem(USER_EMAIL_KEY, email);
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  await AsyncStorage.removeItem(USER_ID_KEY);
  await AsyncStorage.removeItem(USER_EMAIL_KEY);
  await AsyncStorage.removeItem(PRO_STATUS_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  const resp = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!resp.ok) {
    await logout();
    return null;
  }
  const {
    access_token,
    refresh_token: newRefreshToken,
    pro_status,
  } = await resp.json();
  if (pro_status) {
    await AsyncStorage.setItem(PRO_STATUS_KEY, JSON.stringify(pro_status));
  }
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, access_token);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
  return access_token;
}

export async function getProStatus(): Promise<{
  is_pro: boolean;
  is_trial: boolean;
  trial_days_left: number;
  pro_expires_at: string | null;
} | null> {
  const raw = await AsyncStorage.getItem(PRO_STATUS_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function getIsPro(): Promise<boolean> {
  const status = await getProStatus();
  return status?.is_pro ?? false;
}

export async function getUserInfo(): Promise<{
  id: string;
  email: string;
} | null> {
  const id = await AsyncStorage.getItem(USER_ID_KEY);
  const email = await AsyncStorage.getItem(USER_EMAIL_KEY);
  if (!id || !email) return null;
  return { id, email };
}

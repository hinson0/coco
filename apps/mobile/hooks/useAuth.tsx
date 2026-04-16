import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  getAccessToken,
  getUserInfo,
  login,
  logout,
  register,
  sendSmsCode as sendSmsCodeApi,
  smsLogin,
} from "../lib/auth";

type AuthState = {
  isAuthenticated: boolean;
  user: { id: string; email: string | null; phone: string | null } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendSmsCode: (phone: string) => Promise<void>;
  smsSignIn: (phone: string, code: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{
    id: string;
    email: string | null;
    phone: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAccessToken(), getUserInfo()]).then(([token, info]) => {
      setIsAuthenticated(!!token);
      setUser(info);
      setLoading(false);
    });
  }, []);

  const signIn = async (email: string, password: string) => {
    await login(email, password);
    const info = await getUserInfo();
    setIsAuthenticated(true);
    setUser(info);
  };

  const signUp = async (email: string, password: string) => {
    await register(email, password);
    const info = await getUserInfo();
    setIsAuthenticated(true);
    setUser(info);
  };

  const signOut = async () => {
    await logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  const sendSmsCode = async (phone: string) => {
    await sendSmsCodeApi(phone);
  };

  const smsSignIn = async (phone: string, code: string) => {
    await smsLogin(phone, code);
    const info = await getUserInfo();
    setIsAuthenticated(true);
    setUser(info);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        signIn,
        signUp,
        signOut,
        sendSmsCode,
        smsSignIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

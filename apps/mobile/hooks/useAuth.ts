import { useEffect, useState } from "react";

import {
  getAccessToken,
  getUserInfo,
  login,
  logout,
  register,
} from "../lib/auth";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
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
  };

  const signOut = async () => {
    await logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  return { isAuthenticated, user, loading, signIn, signUp, signOut };
}

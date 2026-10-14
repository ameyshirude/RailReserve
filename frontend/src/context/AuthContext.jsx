import React, { createContext, useContext, useEffect, useState, useCallback, startTransition } from "react";
import apiClient, { setLogoutHandler } from "../api/axiosClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try { await apiClient.post("/auth/logout"); } catch {}
    try {
      Object.keys(sessionStorage).filter((key) => key.startsWith("railreserve:booking:")).forEach((key) => sessionStorage.removeItem(key));
    } catch { }
    startTransition(() => setUser(null));
  }, []);

  useEffect(() => {
    setLogoutHandler(() => {
      startTransition(() => setUser(null));
    });
    return () => setLogoutHandler(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

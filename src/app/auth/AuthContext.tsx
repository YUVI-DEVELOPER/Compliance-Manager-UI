import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";

import { getCurrentUser, loginWithPassword, logoutSession } from "../../services/auth.service";
import {
  clearStoredAuth,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
  StoredAuthUser,
} from "./authStorage";

interface AuthContextValue {
  user: StoredAuthUser | null;
  roles: string[];
  permissions: string[];
  token: string | null;
  isAuthenticated: boolean;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (permissionCodes: string[]) => boolean;
  hasAllPermissions: (permissionCodes: string[]) => boolean;
  hasRole: (roleCode: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const normalizeCode = (value: string) => value.trim().toUpperCase();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<StoredAuthUser | null>(() => getStoredUser());
  const [initializing, setInitializing] = useState(Boolean(getStoredToken()));

  const clearSession = useCallback(() => {
    clearStoredAuth();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setInitializing(false);
      return;
    }

    let cancelled = false;
    setInitializing(true);
    getCurrentUser()
      .then((profile) => {
        if (cancelled) return;
        setUser(profile);
        setStoredUser(profile);
      })
      .catch(() => {
        if (!cancelled) clearSession();
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clearSession, token]);

  useEffect(() => {
    const handleUnauthorized = () => clearSession();
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginWithPassword(email, password);
    setStoredToken(response.access_token);
    setStoredUser(response.user);
    setToken(response.access_token);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getStoredToken()) {
        await logoutSession();
      }
    } catch {
      // Local logout must always complete even if the server audit call fails.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const roles = useMemo(() => user?.roles ?? [], [user]);
  const permissions = useMemo(() => user?.permissions ?? [], [user]);

  const hasPermission = useCallback(
    (permissionCode: string) => permissions.includes(normalizeCode(permissionCode)),
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (permissionCodes: string[]) => permissionCodes.some((permissionCode) => hasPermission(permissionCode)),
    [hasPermission],
  );

  const hasAllPermissions = useCallback(
    (permissionCodes: string[]) => permissionCodes.every((permissionCode) => hasPermission(permissionCode)),
    [hasPermission],
  );

  const hasRole = useCallback(
    (roleCode: string) => roles.includes(normalizeCode(roleCode)),
    [roles],
  );

  const value = useMemo<AuthContextValue>(() => ({
    user,
    roles,
    permissions,
    token,
    isAuthenticated: Boolean(token && user),
    initializing,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
  }), [
    hasAllPermissions,
    hasAnyPermission,
    hasPermission,
    hasRole,
    initializing,
    login,
    logout,
    permissions,
    roles,
    token,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiClient, setAccessToken, setUnauthorizedHandler, getApiErrorMessage } from "@/lib/apiClient";
import type { CurrentUser, TenantSummary } from "@/types";
import { makeMenuAccessCheck, type MenuAccessCheck } from "@/components/layout/moreMenuItems";

interface AuthContextValue {
  user: CurrentUser | null;
  tenant: TenantSummary | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: { mobile: string; password: string; rememberMe?: boolean }) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  /** Re-fetches /auth/me — used after an action that changes the tenant (e.g. selecting a plan) so the UI updates without a full re-login. */
  refreshTenant: () => Promise<void>;
  hasRole: (...roles: CurrentUser["roles"]) => boolean;
  /** Combines a menu item's role default with any Super-Admin per-user override. */
  canAccessMenu: MenuAccessCheck;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [tenant, setTenant] = useState<TenantSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function bootstrap() {
    try {
      const res = await apiClient.post("/auth/refresh");
      const token = res.data?.data?.accessToken as string;
      setAccessToken(token);
      const me = await apiClient.get("/auth/me");
      setUser(me.data.data);
      setTenant(me.data.data.tenant);
    } catch {
      setAccessToken(null);
      setUser(null);
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setTenant(null);
      setAccessToken(null);
    });
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(input: { mobile: string; password: string; rememberMe?: boolean }) {
    try {
      const res = await apiClient.post("/auth/login", input);
      setAccessToken(res.data.data.accessToken);
      setUser(res.data.data.user);
      setTenant(res.data.data.tenant);
      return res.data.data.user as CurrentUser;
    } catch (err) {
      throw new Error(getApiErrorMessage(err, "Invalid mobile number or password"));
    }
  }

  async function refreshTenant() {
    try {
      const me = await apiClient.get("/auth/me");
      setUser(me.data.data);
      setTenant(me.data.data.tenant);
    } catch {
      // Leave current state as-is — this is a best-effort refresh, not a session check.
    }
  }

  async function logout() {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // ignore network errors on logout — clear client state regardless
    }
    setAccessToken(null);
    setUser(null);
    setTenant(null);
  }

  function hasRole(...roles: CurrentUser["roles"]) {
    if (!user) return false;
    return user.roles.some((r) => roles.includes(r));
  }

  const canAccessMenu: MenuAccessCheck = user ? makeMenuAccessCheck(user.menuAccess ?? {}, hasRole) : () => false;

  return (
    <AuthContext.Provider value={{ user, tenant, isLoading, isAuthenticated: !!user, login, logout, refreshTenant, hasRole, canAccessMenu }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

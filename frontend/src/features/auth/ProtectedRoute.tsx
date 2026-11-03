import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { RoleName } from "@/types";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ roles, menuKey }: { roles?: RoleName[]; menuKey?: string }) {
  const { isAuthenticated, isLoading, hasRole, canAccessMenu } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-navy-950">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600 dark:text-brand-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // A route with a menuKey is governed entirely by canAccessMenu, which
  // already folds the role check in (see makeMenuAccessCheck): an explicit
  // per-user grant wins even over the role gate, so a menu item a Tenant
  // Admin turns on for someone is actually reachable, not just visible in
  // the sidebar. A route with no menuKey has no override mechanism at all,
  // so it stays a plain role gate.
  if (menuKey) {
    if (!canAccessMenu(menuKey, roles)) {
      return <Navigate to="/no-access" replace />;
    }
  } else if (roles && !hasRole(...roles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

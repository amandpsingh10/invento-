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

  if (roles && !hasRole(...roles)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Distinct from the role check above: a role failure means "you're not
  // the right kind of user" (bounced to the dashboard you do have). A menu
  // failure means Super Admin explicitly revoked this specific item from
  // this user, so it goes to a dedicated page instead — bouncing to
  // /dashboard here could loop if dashboard itself was ever revoked too.
  if (menuKey && !canAccessMenu(menuKey, roles)) {
    return <Navigate to="/no-access" replace />;
  }

  return <Outlet />;
}

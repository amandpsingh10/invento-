import { Link } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/AuthContext";

export function NoAccessPage() {
  const { canAccessMenu, logout } = useAuth();
  const canGoToDashboard = canAccessMenu("dashboard");

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center dark:bg-navy-950">
      <ShieldOff className="h-12 w-12 text-slate-300 dark:text-slate-600" />
      <p className="mt-3 text-lg font-semibold text-slate-700 dark:text-slate-300">You don't have access to this page</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">Ask your administrator to grant access to this menu item.</p>
      <div className="mt-6 flex gap-2">
        {canGoToDashboard && (
          <Link to="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        )}
        <Button variant="outline" onClick={() => logout()}>
          Log Out
        </Button>
      </div>
    </div>
  );
}

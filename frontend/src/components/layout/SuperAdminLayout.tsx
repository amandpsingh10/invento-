import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Boxes, LayoutDashboard, Building2, CreditCard, LogOut, Menu, X, Sun, Moon } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useTheme } from "@/features/theme/ThemeContext";
import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/branding";

export function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-navy-950">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-72 max-w-[85vw] flex-col bg-navy-950 text-white transition-transform duration-200 ease-out",
          "lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600">
            <Boxes className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold leading-tight tracking-tight">{PRODUCT_NAME}</p>
            <p className="text-[11px] leading-tight text-slate-400">Platform Administration</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4">
          <NavLink
            to="/super-admin/dashboard"
            className={({ isActive }) =>
              cn("mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white", isActive && "bg-brand-600/15 text-brand-300")
            }
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </NavLink>
          <NavLink
            to="/super-admin/dealers"
            className={({ isActive }) =>
              cn("mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white", isActive && "bg-brand-600/15 text-brand-300")
            }
          >
            <Building2 className="h-4 w-4" /> Dealers
          </NavLink>
          <NavLink
            to="/super-admin/plans"
            className={({ isActive }) =>
              cn("mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white", isActive && "bg-brand-600/15 text-brand-300")
            }
          >
            <CreditCard className="h-4 w-4" /> Plans
          </NavLink>
        </nav>
        <div className="border-t border-white/10 p-3">
          <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-3 dark:border-navy-800 dark:bg-navy-900 sm:justify-end sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800"
              title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle dark mode"
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <p className="truncate text-sm text-slate-600 dark:text-slate-400" title={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()}>
              {user?.firstName} {user?.lastName} &middot; <span className="text-slate-400 dark:text-slate-500">Super Admin</span>
            </p>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 thin-scroll sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

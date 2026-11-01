import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Boxes, LayoutDashboard, Building2, CreditCard, LogOut, Menu, X, Sun, Moon, ChevronsLeft, ChevronsRight, ChevronDown } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useTheme } from "@/features/theme/ThemeContext";
import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/branding";

const STORAGE_KEY = "invento_superadmin_sidebar_expanded";

const NAV_ITEMS = [
  { to: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/super-admin/dealers", label: "Dealers", icon: Building2 },
  { to: "/super-admin/plans", label: "Plans", icon: CreditCard },
];

/**
 * Same light, collapsible icon-rail look as the dealer-side Sidebar (see
 * components/layout/Sidebar.tsx) — this used to be a separate dark navy
 * shell, the one visibly different thing between the Super Admin and
 * dealer apps once everything else had already moved to the lighter,
 * denser style. Nav items stay hardcoded (just 3, platform-level) rather
 * than switching to moreMenuItems.ts, which is dealer menu data.
 */
export function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
    } catch {
      // Private browsing / storage blocked — collapse state just won't persist.
    }
  }, [expanded]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800",
      !expanded && "lg:justify-center lg:px-0",
      isActive && "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
    );

  const sidebarInner = (forceLabels: boolean) => (
    <>
      <div className={cn("flex h-16 shrink-0 items-center border-b border-slate-200 dark:border-navy-800", expanded || forceLabels ? "justify-between px-4" : "justify-center")}>
        {(expanded || forceLabels) && (
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600">
              <Boxes className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-display truncate text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">{PRODUCT_NAME}</p>
              <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">Platform Administration</p>
            </div>
          </div>
        )}
        {forceLabels ? (
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-navy-800 dark:hover:text-slate-300"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-navy-800 dark:hover:text-slate-300 lg:block"
            aria-label={expanded ? "Collapse menu" : "Expand menu"}
            title={expanded ? "Collapse menu" : "Expand menu"}
          >
            {expanded ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto thin-scroll px-2.5 py-3">
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass} title={!expanded && !forceLabels ? item.label : undefined}>
              <item.icon className="h-4 w-4 shrink-0" />
              {(expanded || forceLabels) && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-200 p-2.5 dark:border-navy-800">
        <button
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10",
            !expanded && !forceLabels && "lg:justify-center lg:px-0"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {(expanded || forceLabels) && "Logout"}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-navy-950">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      {/* Mobile slide-in drawer — always shows labels */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 max-w-[85vw] flex-col bg-white transition-transform duration-200 ease-out dark:bg-navy-900 lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarInner(true)}
      </aside>

      {/* Desktop icon-rail — collapsible, same as the dealer-side Sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-150 ease-out dark:border-navy-800 dark:bg-navy-900 print:hidden lg:flex",
          expanded ? "w-56" : "w-16"
        )}
      >
        {sidebarInner(false)}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 dark:border-navy-800 dark:bg-navy-900 print:hidden sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="hidden lg:block" />

          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800"
              title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle dark mode"
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-navy-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white dark:bg-navy-700">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </div>
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-medium leading-tight text-slate-800 dark:text-slate-200">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-[11px] leading-tight text-slate-400 dark:text-slate-500">Super Admin</p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  collisionPadding={12}
                  className="z-50 w-[calc(100vw-1.5rem)] max-w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-navy-700 dark:bg-navy-900"
                >
                  <div className="px-2 py-2">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200" title={user?.email}>
                      {user?.email}
                    </p>
                  </div>
                  <DropdownMenu.Item
                    onClick={handleLogout}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-600 outline-none hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" /> Logout
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 thin-scroll sm:px-6 print:overflow-visible print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { NavLink, Outlet, useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Boxes, LayoutDashboard, Building2, CreditCard, Users, Settings, LogOut, Sun, Moon } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useTheme } from "@/features/theme/ThemeContext";
import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/branding";

const NAV_ITEMS = [
  { to: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/super-admin/dealers", label: "Dealers", icon: Building2 },
  { to: "/super-admin/plans", label: "Plans & Billing", icon: CreditCard },
  { to: "/super-admin/users", label: "Users", icon: Users },
  { to: "/super-admin/settings", label: "Settings", icon: Settings },
];

/** A horizontal top nav instead of a side rail — Super Admin only has 5 destinations, so a full-width bar reads better than a collapsible sidebar built for the dealer app's much longer menu. */
export function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-navy-800 dark:hover:text-slate-200",
      isActive && "bg-slate-100 font-semibold text-slate-900 dark:bg-navy-800 dark:text-slate-100"
    );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-navy-950">
      <header className="shrink-0 border-b border-slate-200 bg-white dark:border-navy-800 dark:bg-navy-900 print:hidden">
        <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 shrink-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-950 dark:bg-brand-600">
              <Boxes className="h-5 w-5 text-white" />
            </div>
            <span className="font-display hidden truncate text-[15px] font-bold tracking-tight text-slate-900 dark:text-slate-100 md:block">{PRODUCT_NAME}</span>
          </div>

          <nav className="hidden flex-1 items-center gap-1 overflow-x-auto thin-scroll lg:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 dark:border-navy-700 dark:text-slate-400 dark:hover:bg-navy-800"
              title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle dark mode"
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-navy-800">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white ring-2 ring-brand-100 dark:ring-brand-500/20">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </div>
                  <div className="hidden text-left sm:block">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Owner</span>
                    </div>
                    <p className="text-[11px] leading-tight text-slate-400 dark:text-slate-500">Super Admin</p>
                  </div>
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
        </div>

        {/* Nav tabs move to their own scrollable row below lg, where the header can't fit everything on one line */}
        <nav className="flex items-center gap-1 overflow-x-auto thin-scroll border-t border-slate-100 px-4 py-2 dark:border-navy-800 sm:px-6 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              <item.icon className="h-3.5 w-3.5" /> {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 thin-scroll sm:px-6 print:overflow-visible print:p-0">
        <Outlet />
      </main>
    </div>
  );
}

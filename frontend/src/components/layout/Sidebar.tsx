import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Boxes, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthContext";
import { visibleMoreMenuGroups, visiblePrimaryTabs } from "./moreMenuItems";
import { PRODUCT_NAME } from "@/lib/branding";

const STORAGE_KEY = "invento_sidebar_expanded";

/**
 * Desktop-only (lg and up — see `hidden lg:flex` below) left navigation.
 * Icon-only by default, so it stays a slim rail that doesn't compete with
 * page content; a toggle at the top expands it to show labels too. Mirrors
 * BottomNav's tab set plus every group from moreMenuItems.ts, so desktop
 * and mobile always expose the exact same destinations from one source of
 * truth. Replaces the old Topbar "Menu" dropdown.
 */
export function Sidebar() {
  const { canAccessMenu } = useAuth();
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
    } catch {
      // Private browsing / storage blocked — collapse state just won't persist.
    }
  }, [expanded]);

  const groups = visibleMoreMenuGroups(canAccessMenu);
  const primaryTabs = visiblePrimaryTabs(canAccessMenu);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800",
      !expanded && "justify-center px-0",
      isActive && "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
    );

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-150 ease-out dark:border-navy-800 dark:bg-navy-900 print:hidden lg:flex",
        expanded ? "w-56" : "w-16"
      )}
    >
      <div className={cn("flex h-16 shrink-0 items-center border-b border-slate-200 dark:border-navy-800", expanded ? "justify-between px-4" : "justify-center")}>
        {expanded && (
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600">
              <Boxes className="h-4 w-4 text-white" />
            </div>
            <span className="font-display truncate text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">{PRODUCT_NAME}</span>
          </div>
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-navy-800 dark:hover:text-slate-300"
          aria-label={expanded ? "Collapse menu" : "Expand menu"}
          title={expanded ? "Collapse menu" : "Expand menu"}
        >
          {expanded ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto thin-scroll px-2.5 py-3">
        <div className="mb-3 space-y-0.5">
          {primaryTabs.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.end} className={linkClass} title={!expanded ? tab.label : undefined}>
              <tab.icon className="h-4 w-4 shrink-0" />
              {expanded && <span className="truncate">{tab.label}</span>}
            </NavLink>
          ))}
        </div>

        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            {expanded && <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{group.label}</p>}
            {!expanded && <div className="mx-2 mb-2 border-t border-slate-100 dark:border-navy-800" />}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass} title={!expanded ? item.label : undefined}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {expanded && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

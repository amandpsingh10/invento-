import type { RoleName } from "@/types";
import {
  LayoutDashboard,
  ShoppingCart,
  ScrollText,
  SlidersHorizontal,
  History,
  Undo2,
  BarChart3,
  Users,
  Store,
  Grid3x3,
  Rows3,
  Boxes,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type MoreMenuColor = "green" | "purple" | "amber" | "blue" | "red" | "orange" | "slate";

/** Circular icon-tile background + icon color for each tone used across the More menu cards. */
export const MORE_MENU_COLOR_CLASSES: Record<MoreMenuColor, string> = {
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  red: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  orange: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
  slate: "bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-400",
};

export interface MoreMenuItem {
  /** Stable identifier persisted by Super Admin's per-user menu access grants. Must match backend/src/modules/admin/menuKeys.ts. */
  key: string;
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
  color: MoreMenuColor;
  roles?: RoleName[];
}

export interface MoreMenuGroup {
  label: string;
  items: MoreMenuItem[];
}

export interface PrimaryTab {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  end: boolean;
  roles?: RoleName[];
}

const INVENTORY_ROLES: RoleName[] = ["TENANT_ADMIN", "INVENTORY_MANAGER"];
const ISSUE_RETURN_ROLES: RoleName[] = ["TENANT_ADMIN", "INVENTORY_MANAGER", "STORE_USER"];
const ADMIN_ROLES: RoleName[] = ["TENANT_ADMIN"];

/**
 * The four always-visible bottom-tab / top-of-sidebar destinations. Single
 * source of truth for both BottomNav (mobile) and Sidebar (desktop) — kept
 * here alongside MORE_MENU_GROUPS so every menu destination in the app,
 * primary or secondary, is defined in exactly one place.
 */
export const PRIMARY_TABS: PrimaryTab[] = [
  { key: "dashboard", label: "Home", to: "/dashboard", icon: LayoutDashboard, end: true },
  { key: "stock", label: "Stock", to: "/inventory/current-stock", icon: Boxes, end: false },
  { key: "sell", label: "Sell", to: "/sell/new", icon: ShoppingCart, end: false },
  { key: "return", label: "Return", to: "/returns/new", icon: Undo2, end: false },
];

/**
 * Every secondary destination that used to live in the permanent sidebar.
 * Now reachable on demand from a "More" menu — the mobile bottom sheet
 * (BottomNav) and the desktop dropdown (Topbar) both render this same list,
 * so nothing was lost when the sidebar was removed and there's exactly one
 * place to add a new destination.
 *
 * "Issue Part" (a standalone, no-preselected-row issue flow) was deliberately
 * dropped from this menu — issuing stock is reachable via the "Issue"
 * quick action on a Current Stock row instead, matching the reference design
 * which only lists Issued Parts + Return History under this group.
 */
export const MORE_MENU_GROUPS: MoreMenuGroup[] = [
  {
    label: "Inventory",
    items: [
      { key: "stock-ledger", label: "Stock Ledger", description: "View all stock movements", to: "/inventory/stock-ledger", icon: ScrollText, color: "green" },
      {
        key: "stock-adjustment",
        label: "Stock Adjustment",
        description: "Adjust stock quantity",
        to: "/inventory/adjustments",
        icon: SlidersHorizontal,
        color: "purple",
        roles: INVENTORY_ROLES,
      },
    ],
  },
  {
    label: "Issue & History",
    items: [
      { key: "issued-parts", label: "Issued Parts", description: "View issued parts", to: "/issues", icon: History, color: "amber", roles: ISSUE_RETURN_ROLES },
      { key: "return-history", label: "Return History", description: "View return transactions", to: "/returns", icon: Undo2, color: "blue", roles: ISSUE_RETURN_ROLES },
    ],
  },
  {
    label: "Reports",
    items: [
      { key: "report-stock", label: "Stock Report", description: "Stock summary report", to: "/reports/stock", icon: BarChart3, color: "green" },
      { key: "report-issues", label: "Issue Report", description: "Issued parts report", to: "/reports/issues", icon: BarChart3, color: "purple" },
      { key: "report-returns", label: "Return Report", description: "Return summary report", to: "/reports/returns", icon: Undo2, color: "orange" },
      { key: "report-transactions", label: "Transaction Report", description: "All transactions", to: "/reports/transactions", icon: FileText, color: "red" },
    ],
  },
  {
    label: "Administration",
    items: [
      { key: "admin-users", label: "Users", description: "Manage system users", to: "/admin-tenant/users", icon: Users, color: "blue", roles: ADMIN_ROLES },
      { key: "admin-stores", label: "Stores", description: "Manage stores", to: "/admin-tenant/stores", icon: Store, color: "green", roles: ADMIN_ROLES },
      { key: "admin-bins", label: "Bins", description: "Manage bins", to: "/admin-tenant/bins", icon: Grid3x3, color: "purple", roles: ADMIN_ROLES },
      { key: "admin-racks", label: "Racks", description: "Manage racks", to: "/admin-tenant/racks", icon: Rows3, color: "orange", roles: ADMIN_ROLES },
      { key: "admin-parts", label: "Parts", description: "Manage parts", to: "/admin-tenant/parts", icon: Boxes, color: "red", roles: ADMIN_ROLES },
      { key: "admin-audit-log", label: "Audit Log", description: "View system logs", to: "/admin-tenant/audit-log", icon: History, color: "slate", roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Settings",
    items: [{ key: "settings", label: "Settings", description: "App preferences and profile", to: "/settings", icon: Settings, color: "slate" }],
  },
];

/**
 * Combines a menu item's role default with any Super-Admin-assigned
 * per-user override: an explicit override always wins; otherwise falls back
 * to the item's normal role gate (or "visible to everyone" if it has none).
 */
export type MenuAccessCheck = (key: string, roles?: RoleName[]) => boolean;

export function makeMenuAccessCheck(menuAccess: Record<string, boolean>, hasRole: (...roles: RoleName[]) => boolean): MenuAccessCheck {
  return (key, roles) => {
    const override = menuAccess[key];
    if (override !== undefined) return override;
    return !roles || hasRole(...roles);
  };
}

export function visibleMoreMenuGroups(canAccess: MenuAccessCheck): MoreMenuGroup[] {
  return MORE_MENU_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccess(item.key, item.roles)),
  })).filter((group) => group.items.length > 0);
}

export function visiblePrimaryTabs(canAccess: MenuAccessCheck): PrimaryTab[] {
  return PRIMARY_TABS.filter((tab) => canAccess(tab.key, tab.roles));
}

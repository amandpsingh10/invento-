/**
 * Menu keys accepted by the per-user menu access endpoints. Mirrors the
 * `key` values on frontend/src/components/layout/moreMenuItems.ts (the
 * source of truth for the app's actual menu structure/labels) — kept here
 * only so the backend can reject typos/garbage instead of persisting them.
 */
export const MENU_KEYS = [
  "dashboard",
  "stock",
  "sell",
  "return",
  "stock-ledger",
  "stock-adjustment",
  "issued-parts",
  "return-history",
  "report-stock",
  "report-issues",
  "report-returns",
  "report-transactions",
  "admin-users",
  "admin-stores",
  "admin-bins",
  "admin-racks",
  "admin-parts",
  "admin-audit-log",
  "settings",
] as const;

export type MenuKey = (typeof MENU_KEYS)[number];

export const MENU_KEY_SET: ReadonlySet<string> = new Set(MENU_KEYS);

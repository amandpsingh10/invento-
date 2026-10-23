import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/features/auth/AuthContext";
import type { PagedResult, LowStockRow, Invoice, DashboardSummary } from "@/types";
import { formatNumber, formatCurrency, formatDate } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/branding";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import {
  Warehouse,
  ShoppingCart,
  Undo2,
  AlertTriangle,
  ArrowRight,
  PackagePlus,
  Receipt,
  Boxes,
  ClipboardCheck,
} from "lucide-react";

const INVOICE_STATUS_TONE: Record<string, "success" | "danger" | "neutral"> = {
  COMPLETED: "success",
  CANCELLED: "danger",
  DRAFT: "neutral",
};

/**
 * "Current Stock" is total units in stock — the sum of every part's
 * quantity across every store/bin/rack — not a count of inventory rows.
 * /inventory's pagination total counts distinct part+location records,
 * which is a different (and much smaller) number; /dashboard already
 * computes the real sum server-side (see getDashboardStockCounts).
 */
function useDashboardCards() {
  return useQuery({
    queryKey: ["dashboard-cards"],
    queryFn: async () => (await apiClient.get<{ data: DashboardSummary }>("/dashboard")).data.data.cards,
    refetchInterval: 60_000,
  });
}

function useLowStockPreview() {
  return useQuery({
    queryKey: ["low-stock-preview"],
    queryFn: async () =>
      (await apiClient.get<{ data: PagedResult<LowStockRow> }>("/inventory/low-stock", { params: { pageSize: 5 } })).data.data,
    refetchInterval: 60_000,
  });
}

function useRecentSales() {
  return useQuery({
    queryKey: ["recent-sales"],
    queryFn: async () => (await apiClient.get<{ data: PagedResult<Invoice> }>("/invoices", { params: { pageSize: 5 } })).data.data,
    refetchInterval: 60_000,
  });
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function StatCard({
  to,
  icon: Icon,
  iconTone,
  title,
  value,
  subtitle,
}: {
  to: string;
  icon: any;
  iconTone: string;
  title: string;
  value?: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-[7.5rem] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition-shadow active:scale-[0.99] hover:shadow-card-hover sm:p-5 dark:border-navy-700 dark:bg-navy-900"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</p>
          <p className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconTone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>
    </Link>
  );
}

function BigActionButton({
  to,
  icon: Icon,
  title,
  subtitle,
  tone,
}: {
  to: string;
  icon: any;
  title: string;
  subtitle: string;
  tone: "brand" | "emerald";
}) {
  const toneClasses = tone === "brand" ? "bg-brand-600 hover:bg-brand-700" : "bg-emerald-600 hover:bg-emerald-700";
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-2xl p-4 text-white shadow-card transition-colors active:scale-[0.99] sm:p-5 ${toneClasses}`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-bold">{title}</p>
        <p className="truncate text-xs text-white/80">{subtitle}</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-white/80" />
    </Link>
  );
}

/**
 * Post-login landing screen: a welcome banner, a 4-card stat/action grid
 * (2-up on mobile, 4-up on desktop), the two highest-frequency actions
 * (Sell/Return) as their own prominent buttons, and — desktop/web only —
 * quick-glance previews of recent sales and low-stock parts. Those two
 * preview widgets are deliberately hidden below the lg breakpoint: on the
 * phone-width mobile app there's no room for them without pushing Sell/
 * Return off the first screen, so mobile stops at the 4 cards + 2 buttons.
 */
export function DashboardPage() {
  const { user, tenant } = useAuth();
  const { data: cards } = useDashboardCards();
  const { data: lowStock } = useLowStockPreview();
  const { data: recentSales } = useRecentSales();

  return (
    <div className="pb-4">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">{PRODUCT_NAME}</h1>
        {tenant && (
          <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {tenant.name}
            {tenant.address && <span className="font-normal text-slate-400 dark:text-slate-500"> — {tenant.address}</span>}
          </p>
        )}
      </div>

      {/* Welcome banner */}
      <div className="relative mb-4 overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-blue-100/70 p-5 sm:p-6 dark:border-brand-500/30 dark:from-brand-500/15 dark:to-blue-500/10">
        <Boxes className="pointer-events-none absolute -right-4 -top-4 h-32 w-32 text-brand-600/10 sm:h-40 sm:w-40 dark:text-brand-400/10" />
        <p className="font-display relative text-lg font-bold text-slate-900 sm:text-xl dark:text-slate-100">
          {greeting()}, {user?.firstName ?? "there"}
        </p>
        <p className="relative mt-1 text-sm text-slate-600 dark:text-slate-300">Manage your inventory with ease</p>
      </div>

      {/* Stat / secondary-action cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          to="/inventory/current-stock"
          icon={Warehouse}
          iconTone="bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
          title="Current Stock"
          value={cards === undefined ? "—" : formatNumber(cards.totalStockQuantity)}
          subtitle="Total parts in inventory"
        />
        <StatCard
          to="/inventory/low-stock"
          icon={AlertTriangle}
          iconTone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
          title="Low Stock"
          value={lowStock === undefined ? "—" : formatNumber(lowStock.total)}
          subtitle="Parts below threshold"
        />
        <StatCard
          to="/invoices"
          icon={Receipt}
          iconTone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
          title="Sales History"
          value={recentSales === undefined ? "—" : formatNumber(recentSales.total)}
          subtitle="Invoices generated"
        />
        <StatCard
          to="/inventory/add"
          icon={PackagePlus}
          iconTone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
          title="Add Inventory"
          value="+"
          subtitle="Add new stock"
        />
      </div>

      {/* Primary actions */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <BigActionButton to="/sell/new" icon={ShoppingCart} title="Sell Part" subtitle="Sell parts to customer" tone="brand" />
        <BigActionButton to="/returns/new" icon={Undo2} title="Return Part" subtitle="Return sold/issued parts" tone="emerald" />
      </div>

      {/* Quick-glance previews — desktop/web only, see comment above */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-navy-800">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Recent Sales</p>
            </div>
            <Link to="/invoices" className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
              View All
            </Link>
          </div>
          {recentSales && recentSales.items.length > 0 ? (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 dark:text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Invoice No</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                  {recentSales.items.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-4 py-2.5">
                        <Link to={`/invoices/${inv.id}`} className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{formatDate(inv.invoiceDate)}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{inv.customer.name}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-800 dark:text-slate-200">{formatCurrency(inv.grandTotal)}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={INVOICE_STATUS_TONE[inv.status] ?? "neutral"}>{inv.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No sales yet" description="Completed sales will show up here." />
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-navy-800">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Low Stock Parts</p>
            </div>
            <Link to="/inventory/low-stock" className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
              View All
            </Link>
          </div>
          {lowStock && lowStock.items.length > 0 ? (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 dark:text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Part No</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 text-right font-medium">Current Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                  {lowStock.items.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{row.partNo}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{row.description}</td>
                      <td
                        className={`px-4 py-2.5 text-right font-semibold ${row.status === "OUT_OF_STOCK" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}
                      >
                        {formatNumber(row.availableQty)} {row.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Nothing low on stock" description="Every part is above its threshold. Nice work." />
          )}
        </Card>
      </div>
    </div>
  );
}

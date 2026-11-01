import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { apiClient } from "@/lib/apiClient";
import type { DealerTenant } from "@/types";
import { Skeleton } from "@/components/ui/Feedback";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/branding";
import { IndianRupee, Users, Activity, Clock, ArrowRight, Download, Plus, CreditCard } from "lucide-react";

interface PlatformDashboard {
  totalDealers: number;
  activeDealers: number;
  trialDealers: number;
  subscriptionRevenue: number;
  activeUsers: number;
  transactionsToday: number;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

/** Builds and downloads a dealer-list CSV from whatever /admin/tenants currently returns — no server-side export endpoint needed for a list this small. */
function exportDealersCsv(dealers: DealerTenant[]) {
  const header = ["Dealer Code", "Name", "Status", "Plan", "Users", "Parts", "Stores", "Created"];
  const rows = dealers.map((d) => [d.dealerCode, d.name, d.status, d.plan ?? "", String(d.userCount), String(d.partCount), String(d.storeCount), d.createdAt]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dealers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SuperAdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => (await apiClient.get<{ data: PlatformDashboard }>("/admin/dashboard")).data.data,
  });

  const { data: dealers } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: async () => (await apiClient.get<{ data: DealerTenant[] }>("/admin/tenants")).data.data,
  });

  const totalDealers = data?.totalDealers ?? 0;
  const activeDealers = data?.activeDealers ?? 0;
  const trialDealers = data?.trialDealers ?? 0;
  const otherDealers = Math.max(0, totalDealers - activeDealers - trialDealers);
  const revenue = data?.subscriptionRevenue ?? 0;

  const activePct = totalDealers > 0 ? (activeDealers / totalDealers) * 100 : 0;
  const trialPct = totalDealers > 0 ? (trialDealers / totalDealers) * 100 : 0;
  const otherPct = totalDealers > 0 ? (otherDealers / totalDealers) * 100 : 0;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {greeting()}, {user?.firstName ?? "there"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Cross-dealer overview of your {PRODUCT_NAME} SaaS ·{" "}
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => dealers && exportDealersCsv(dealers)} disabled={!dealers?.length}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" onClick={() => navigate("/super-admin/dealers", { state: { openCreate: true } })}>
            <Plus className="h-4 w-4" /> Add dealer
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Revenue — dark, matches the reference's "hero" treatment for the one number that matters most */}
        <Card className="border-0 bg-navy-950 lg:col-span-2 dark:bg-navy-950">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <IndianRupee className="h-4 w-4" />
              </div>
              Subscription revenue · monthly
            </div>
            {isLoading ? (
              <Skeleton className="mt-3 h-10 w-40 bg-white/10" />
            ) : (
              <p className="font-display mt-3 text-4xl font-bold tabular-nums tracking-tight text-white">{formatCurrency(revenue)}</p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-xs">
              <div>
                <p className="text-slate-400">Annual run-rate</p>
                <p className="mt-0.5 font-semibold tabular-nums text-white">{formatCurrency(revenue * 12)}</p>
              </div>
              <div>
                <p className="text-slate-400">Avg. per active dealer</p>
                <p className="mt-0.5 font-semibold tabular-nums text-white">{formatCurrency(activeDealers > 0 ? revenue / activeDealers : 0)}</p>
              </div>
              <div>
                <p className="text-slate-400">Paying dealers</p>
                <p className="mt-0.5 font-semibold tabular-nums text-white">
                  {activeDealers} of {totalDealers}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dealers breakdown */}
        <Card className="lg:col-span-3">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Dealers</p>
              <Link to="/super-admin/dealers" className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
                View all dealers <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {isLoading ? (
              <Skeleton className="mt-3 h-10 w-24" />
            ) : (
              <p className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">{totalDealers}</span>
                <span className="text-sm text-slate-400 dark:text-slate-500">total on the platform</span>
              </p>
            )}

            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800">
              {activePct > 0 && <div className="bg-emerald-500" style={{ width: `${activePct}%` }} />}
              {trialPct > 0 && <div className="bg-amber-500" style={{ width: `${trialPct}%` }} />}
              {otherPct > 0 && <div className="bg-slate-300 dark:bg-navy-600" style={{ width: `${otherPct}%` }} />}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 p-2.5 dark:border-navy-700">
                <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> Active
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{activeDealers}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-2.5 dark:border-navy-700">
                <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /> On trial
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{trialDealers}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-2.5 dark:border-navy-700">
                <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-navy-600" /> Inactive / other
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{otherDealers}</p>
              </div>
              <Link
                to="/super-admin/dealers"
                className="rounded-lg bg-brand-50 p-2.5 transition-colors hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/15"
              >
                <p className="text-xs text-brand-600 dark:text-brand-400">Trial → paid</p>
                <p className="mt-1 text-sm font-bold text-brand-700 dark:text-brand-400">
                  {trialDealers > 0 ? `Follow up ${trialDealers} trial${trialDealers === 1 ? "" : "s"}` : "All caught up"}
                </p>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active users</p>
              {isLoading ? <Skeleton className="mt-1 h-6 w-12" /> : <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatNumber(data?.activeUsers ?? 0)}</p>}
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Across all dealers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Transactions today</p>
              {isLoading ? <Skeleton className="mt-1 h-6 w-12" /> : <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatNumber(data?.transactionsToday ?? 0)}</p>}
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Sales, issues &amp; returns</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Dealers on trial</p>
              {isLoading ? <Skeleton className="mt-1 h-6 w-12" /> : <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{trialDealers}</p>}
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Convert before trial ends</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="mb-2 px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Quick actions</p>
            <div className="space-y-1.5">
              <button
                onClick={() => navigate("/super-admin/dealers", { state: { openCreate: true } })}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-navy-800"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  Onboard a dealer
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
              </button>
              <Link
                to="/super-admin/plans"
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-navy-800"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                    <CreditCard className="h-3.5 w-3.5" />
                  </span>
                  Manage plans &amp; billing
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LogOut, ShieldAlert } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { Plan } from "@/types";
import { useAuth } from "@/features/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";

function isTrialExpired(tenant: { status?: string; trialEndsAt?: string | null } | null): boolean {
  if (!tenant || tenant.status !== "TRIAL" || !tenant.trialEndsAt) return false;
  return new Date(tenant.trialEndsAt) < new Date();
}

function PlanCard({ plan, onSelect, isSelecting }: { plan: Plan; onSelect: () => void; isSelecting: boolean }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900">
      <p className="text-base font-bold text-slate-900 dark:text-slate-100">{plan.name}</p>
      <p className="mt-1 text-2xl font-bold text-brand-600 dark:text-brand-400">
        {formatCurrency(plan.priceMonthly)}
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500"> /month</span>
      </p>
      {plan.description && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>}
      <ul className="mt-3 flex-1 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
        <li>Up to {plan.maxUsers} users</li>
        <li>Up to {plan.maxStores} stores</li>
        <li>Up to {plan.maxParts.toLocaleString("en-IN")} parts</li>
        <li>{plan.maxMonthlyTxns.toLocaleString("en-IN")} transactions / month</li>
      </ul>
      <Button className="mt-4 w-full" isLoading={isSelecting} onClick={onSelect}>
        <CheckCircle2 className="h-4 w-4" /> Select {plan.name}
      </Button>
    </div>
  );
}

export function TrialExpiredModal() {
  const { tenant, user, hasRole, logout, refreshTenant } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<Plan | null>(null);

  const expired = isTrialExpired(tenant);
  const isAdmin = hasRole("TENANT_ADMIN");

  const { data: plans, isLoading } = useQuery({
    queryKey: ["tenant-plans"],
    queryFn: async () => (await apiClient.get<{ data: Plan[] }>("/tenant/plans")).data.data,
    enabled: expired && isAdmin,
  });

  const selectPlan = useMutation({
    mutationFn: async (planCode: string) => apiClient.post("/tenant/select-plan", { planCode }),
    onSuccess: async (_res, planCode) => {
      const plan = plans?.find((p) => p.code === planCode);
      push({ tone: "success", title: "Plan activated", description: plan ? `You're now on the ${plan.name} plan.` : undefined });
      queryClient.invalidateQueries();
      await refreshTenant();
      setConfirming(null);
    },
    onError: (err) => {
      push({ tone: "error", title: "Couldn't activate plan", description: getApiErrorMessage(err) });
      setConfirming(null);
    },
  });

  if (!expired) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-50 p-6 shadow-2xl dark:bg-navy-950 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-100">Your free trial has ended</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isAdmin
              ? "Choose a plan below to keep using " + (tenant?.name ?? "your dealership") + "."
              : "Ask your dealership's admin to choose a plan to continue."}
          </p>
        </div>

        {isAdmin ? (
          isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-64 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {plans?.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onSelect={() => setConfirming(plan)} isSelecting={selectPlan.isPending && confirming?.id === plan.id} />
              ))}
            </div>
          )
        ) : (
          <p className="mx-auto max-w-xs text-center text-sm text-slate-500 dark:text-slate-400">
            Signed in as {user?.firstName} {user?.lastName}. Only {tenant?.name ?? "your dealership"}'s admin can select a plan.
          </p>
        )}

        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => logout()}>
            <LogOut className="h-4 w-4" /> Log Out
          </Button>
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-navy-900">
            <p className="text-base font-bold text-slate-900 dark:text-slate-100">Confirm plan selection</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Activate the <span className="font-semibold text-slate-700 dark:text-slate-300">{confirming.name}</span> plan (
              {formatCurrency(confirming.priceMonthly)}/month) for {tenant?.name}?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button isLoading={selectPlan.isPending} onClick={() => selectPlan.mutate(confirming.code)}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

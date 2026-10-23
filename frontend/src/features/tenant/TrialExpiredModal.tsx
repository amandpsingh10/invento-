import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { CheckCircle2, Copy, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { Plan } from "@/types";
import { useAuth } from "@/features/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { PLATFORM_UPI_ID, buildUpiLink } from "@/lib/payment";

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

/** Shown once a plan is activated — a UPI "scan to pay" QR for the monthly amount, pre-filled via a standard upi:// deep link. */
function PaymentStep({ plan, tenantName, onDone }: { plan: Plan; tenantName?: string; onDone: () => void }) {
  const { push } = useToast();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const link = buildUpiLink(Number(plan.priceMonthly), `${tenantName ?? "Dealer"} - ${plan.name} plan`);
    QRCode.toDataURL(link, { width: 240, margin: 1 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [plan, tenantName]);

  function copyUpiId() {
    navigator.clipboard
      .writeText(PLATFORM_UPI_ID)
      .then(() => push({ tone: "success", title: "UPI ID copied" }))
      .catch(() => push({ tone: "error", title: "Couldn't copy", description: "Copy it manually instead." }));
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-100">{plan.name} plan activated</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        Scan this code with any UPI app (GPay, PhonePe, Paytm) to pay {formatCurrency(plan.priceMonthly)} for this month.
      </p>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
        {qrDataUrl ? <img src={qrDataUrl} alt="UPI payment QR code" width={220} height={220} /> : <div className="skeleton h-[220px] w-[220px]" />}
      </div>

      <button
        onClick={copyUpiId}
        className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-800"
      >
        <Copy className="h-3.5 w-3.5" /> {PLATFORM_UPI_ID}
      </button>

      <Button className="mt-6" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

export function TrialExpiredModal() {
  const { tenant, user, hasRole, logout, refreshTenant } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<Plan | null>(null);
  const [activatedPlan, setActivatedPlan] = useState<Plan | null>(null);

  const expired = isTrialExpired(tenant);
  const isAdmin = hasRole("TENANT_ADMIN");

  const { data: plans, isLoading } = useQuery({
    queryKey: ["tenant-plans"],
    queryFn: async () => (await apiClient.get<{ data: Plan[] }>("/tenant/plans")).data.data,
    enabled: expired && isAdmin,
  });

  const selectPlan = useMutation({
    mutationFn: async (planCode: string) => apiClient.post("/tenant/select-plan", { planCode }),
    onSuccess: (_res, planCode) => {
      const plan = plans?.find((p) => p.code === planCode);
      queryClient.invalidateQueries();
      setConfirming(null);
      // Deliberately don't refreshTenant() yet — that would clear the
      // trial-expired state (and unmount this modal) before the dealer has
      // seen the payment QR. It only runs once they tap Done below.
      if (plan) setActivatedPlan(plan);
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
        {activatedPlan ? (
          <PaymentStep
            plan={activatedPlan}
            tenantName={tenant?.name}
            onDone={async () => {
              await refreshTenant();
              setActivatedPlan(null);
            }}
          />
        ) : (
          <>
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
          </>
        )}
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

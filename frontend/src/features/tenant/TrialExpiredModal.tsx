import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { CheckCircle2, Copy, LogOut, MessageCircle, Phone, ShieldAlert, ShieldCheck, Sliders } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { Plan } from "@/types";
import { useAuth } from "@/features/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, cn } from "@/lib/utils";
import { PLATFORM_UPI_ID, PLATFORM_CONTACT_NUMBER, buildUpiLink } from "@/lib/payment";
import { PRIMARY_TABS, MORE_MENU_GROUPS } from "@/components/layout/moreMenuItems";

const ALL_MENU_ITEMS = [
  ...PRIMARY_TABS.map((t) => ({ key: t.key, label: t.label })),
  ...MORE_MENU_GROUPS.flatMap((g) => g.items.map((i) => ({ key: i.key, label: i.label }))),
];

// Same fixed rates as the Super Admin's own custom-plan calculator
// (PlansPage.tsx) — shown here only to preview the price; the real amount
// is always computed server-side from these same numbers.
const CUSTOM_PLAN_BASE = 800;
const CUSTOM_PLAN_PER_USER = 30;
const CUSTOM_PLAN_PER_MENU = 50;

/**
 * A dealer needs to pick/renew a plan once either their trial or their
 * current paid cycle has run out — the latter relies on planEndsAt
 * (Subscription.endsAt, stamped 30 days / 365 days out whenever a plan is
 * selected or assigned; see backend/src/lib/billing.ts).
 */
function isRenewalDue(tenant: { status?: string; trialEndsAt?: string | null; planEndsAt?: string | null } | null): boolean {
  if (!tenant) return false;
  const now = new Date();
  if (tenant.status === "TRIAL") return !!tenant.trialEndsAt && new Date(tenant.trialEndsAt) < now;
  if (tenant.status === "ACTIVE") return !!tenant.planEndsAt && new Date(tenant.planEndsAt) < now;
  return false;
}

function PlanCard({ plan, onSelect, isSelecting }: { plan: Plan; onSelect: () => void; isSelecting: boolean }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900">
      <p className="text-base font-bold text-slate-900 dark:text-slate-100">{plan.name}</p>
      <p className="mt-1 text-2xl font-bold text-brand-600 dark:text-brand-400">
        {formatCurrency(plan.priceMonthly)}
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500"> /{plan.billingCycle === "ANNUAL" ? "year" : "month"}</span>
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

function CycleToggle({ value, onChange }: { value: "MONTHLY" | "ANNUAL"; onChange: (v: "MONTHLY" | "ANNUAL") => void }) {
  return (
    <div className="mx-auto flex w-fit rounded-full border border-slate-200 bg-white p-1 dark:border-navy-700 dark:bg-navy-900">
      {(["MONTHLY", "ANNUAL"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
            value === v ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          {v === "MONTHLY" ? "Monthly" : "Annual"}
        </button>
      ))}
    </div>
  );
}

/** Dealer-facing fallback contact row for anyone who'd still rather just call/WhatsApp instead of using the builder below. */
function ContactRow() {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
      <a
        href={`tel:+91${PLATFORM_CONTACT_NUMBER}`}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-800"
      >
        <Phone className="h-3.5 w-3.5" /> Call {PLATFORM_CONTACT_NUMBER}
      </a>
      <a
        href={`https://wa.me/91${PLATFORM_CONTACT_NUMBER}?text=${encodeURIComponent("Hi, I'd like to discuss a custom plan for my dealership on Invento.")}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-800"
      >
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </a>
    </div>
  );
}

/**
 * Dealer self-service plan builder for needs the 3 standard tiers don't
 * cover — pick users + menus, see the price computed from the same fixed
 * rates Super Admin uses, then activate straight into the same UPI payment
 * step the standard tiers use. No discount control here — that's
 * Super-Admin-only (see PlansPage.tsx's pricing calculator).
 */
function CustomPlanBuilder({ cycle, onActivated }: { cycle: "MONTHLY" | "ANNUAL"; onActivated: (plan: Plan) => void }) {
  const [open, setOpen] = useState(false);
  const [maxUsers, setMaxUsers] = useState(3);
  const [menuKeys, setMenuKeys] = useState<Record<string, boolean>>({});
  const { push } = useToast();

  const checkedCount = Object.values(menuKeys).filter(Boolean).length;
  const monthlyTotal = CUSTOM_PLAN_BASE + maxUsers * CUSTOM_PLAN_PER_USER + checkedCount * CUSTOM_PLAN_PER_MENU;
  const total = cycle === "ANNUAL" ? monthlyTotal * 10 : monthlyTotal;

  const create = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<{ data: { plan: Plan } }>("/tenant/custom-plan", {
          billingCycle: cycle,
          maxUsers,
          allowedMenuKeys: ALL_MENU_ITEMS.filter((i) => menuKeys[i.key]).map((i) => i.key),
        })
      ).data.data.plan,
    onSuccess: (plan) => onActivated(plan),
    onError: (err) => push({ tone: "error", title: "Couldn't activate your plan", description: getApiErrorMessage(err) }),
  });

  if (!open) {
    return (
      <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center dark:border-navy-700 dark:bg-navy-900/60">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Need something different?</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Build a plan with exactly the users and menus your dealership needs.</p>
        <Button type="button" size="sm" variant="outline" className="mt-1" onClick={() => setOpen(true)}>
          <Sliders className="h-3.5 w-3.5" /> Build Your Own Plan
        </Button>
        <ContactRow />
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-dashed border-brand-300 bg-brand-50/40 p-4 text-left dark:border-brand-500/40 dark:bg-brand-500/5">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
          <Sliders className="h-4 w-4" /> Build Your Own Plan
        </p>
        <button onClick={() => setOpen(false)} className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          Cancel
        </button>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Number of users</label>
        <input
          type="number"
          min={1}
          value={maxUsers}
          onChange={(e) => setMaxUsers(Math.max(1, Number(e.target.value) || 1))}
          className="h-9 w-24 rounded-lg border border-slate-200 px-2.5 text-sm dark:border-navy-700 dark:bg-navy-900 dark:text-slate-100"
        />
      </div>

      <div className="mb-3">
        <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">Menus ({checkedCount} selected)</p>
        <div className="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto thin-scroll sm:grid-cols-2">
          {ALL_MENU_ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-300"
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-navy-600"
                checked={menuKeys[item.key] ?? false}
                onChange={(e) => setMenuKeys({ ...menuKeys, [item.key]: e.target.checked })}
              />
              <span className="truncate">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-navy-700 dark:bg-navy-900">
        <div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Your plan's price</p>
          <p className="text-sm font-bold tabular-nums text-brand-600 dark:text-brand-400">
            {formatCurrency(total)} / {cycle === "ANNUAL" ? "year" : "month"}
          </p>
        </div>
        <Button type="button" size="sm" isLoading={create.isPending} onClick={() => create.mutate()}>
          Activate &amp; Pay
        </Button>
      </div>
    </div>
  );
}

export function TrialExpiredModal() {
  const { tenant, user, hasRole, logout, refreshTenant } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<Plan | null>(null);
  const [activatedPlan, setActivatedPlan] = useState<Plan | null>(null);
  const [cycle, setCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");

  const expired = isRenewalDue(tenant);
  const isTrialCase = tenant?.status === "TRIAL";
  const isAdmin = hasRole("TENANT_ADMIN");

  const { data: plans, isLoading } = useQuery({
    queryKey: ["tenant-plans"],
    queryFn: async () => (await apiClient.get<{ data: Plan[] }>("/tenant/plans")).data.data,
    enabled: expired && isAdmin,
  });

  const visiblePlans = useMemo(() => plans?.filter((p) => p.billingCycle === cycle) ?? [], [plans, cycle]);
  const hasAnnualPlans = plans?.some((p) => p.billingCycle === "ANNUAL") ?? false;

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
              <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-100">
                {isTrialCase ? "Your free trial has ended" : "Your plan has ended"}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {isAdmin
                  ? (isTrialCase ? "Choose a plan below to keep using " : "Renew or rebuild a plan below to keep using ") +
                    (tenant?.name ?? "your dealership") +
                    "."
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
                <>
                  {hasAnnualPlans && <div className="mb-4"><CycleToggle value={cycle} onChange={setCycle} /></div>}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {visiblePlans.map((plan) => (
                      <PlanCard key={plan.id} plan={plan} onSelect={() => setConfirming(plan)} isSelecting={selectPlan.isPending && confirming?.id === plan.id} />
                    ))}
                  </div>
                  <CustomPlanBuilder
                    cycle={cycle}
                    onActivated={(plan) => {
                      queryClient.invalidateQueries();
                      setActivatedPlan(plan);
                    }}
                  />
                </>
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

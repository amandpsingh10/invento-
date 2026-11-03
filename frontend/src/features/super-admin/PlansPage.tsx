import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Users, Store, Boxes, Receipt, Sheet, HardDrive, ListChecks, Calculator, ArrowDown } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { Plan } from "@/types";
import { PageHeader } from "@/components/ui/Feedback";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { IconFieldRow } from "@/components/ui/IconFieldRow";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { PRIMARY_TABS, MORE_MENU_GROUPS } from "@/components/layout/moreMenuItems";

const ALL_MENU_KEYS = [...PRIMARY_TABS.map((t) => t.key), ...MORE_MENU_GROUPS.flatMap((g) => g.items.map((i) => i.key))];

const DEFAULT_CALC_RATES = { base: "0", perUser: "150", perMenu: "100" };
// Fixed, non-editable rates for a Custom plan — matches the formula the
// dealer-facing self-service builder (TrialExpiredModal.tsx) uses too, so a
// custom plan prices the same way whether Super Admin or the dealer builds it.
const CUSTOM_CALC_RATES = { base: "800", perUser: "30", perMenu: "50" };

const emptyEditForm = {
  code: "",
  name: "",
  description: "",
  billingCycle: "MONTHLY" as "MONTHLY" | "ANNUAL",
  priceMonthly: "0",
  maxUsers: "1",
  maxStores: "1",
  maxParts: "1",
  maxMonthlyTxns: "1",
  maxExcelUploadRows: "1",
  maxStorageMb: "1",
  isCustom: false,
  isActive: true,
  allowedMenuKeys: {} as Record<string, boolean>,
};

export function PlansPage() {
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyEditForm);
  const [error, setError] = useState<string | null>(null);
  const [calcRates, setCalcRates] = useState(DEFAULT_CALC_RATES);
  const [discountPercent, setDiscountPercent] = useState("0");
  const [tagDealerId, setTagDealerId] = useState("");
  const { push } = useToast();
  const queryClient = useQueryClient();

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => (await apiClient.get<{ data: Plan[] }>("/admin/plans")).data.data,
  });

  const { data: dealers } = useQuery({
    queryKey: ["admin-tenants-lite"],
    queryFn: async () => (await apiClient.get<{ data: { id: string; name: string; dealerCode: string }[] }>("/admin/tenants")).data.data,
    enabled: !creating && !!editing?.isCustom,
  });

  const tagToDealer = useMutation({
    mutationFn: async () => apiClient.put(`/admin/tenants/${tagDealerId}/plan`, { planCode: editing!.code }),
    onSuccess: () => {
      push({ tone: "success", title: "Plan tagged to dealer" });
      setTagDealerId("");
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
    onError: (err) => push({ tone: "error", title: "Couldn't tag plan", description: getApiErrorMessage(err) }),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description.trim() || null,
        billingCycle: form.billingCycle,
        priceMonthly: Number(form.priceMonthly),
        maxUsers: Number(form.maxUsers),
        maxStores: Number(form.maxStores),
        maxParts: Number(form.maxParts),
        maxMonthlyTxns: Number(form.maxMonthlyTxns),
        maxExcelUploadRows: Number(form.maxExcelUploadRows),
        maxStorageMb: Number(form.maxStorageMb),
        isCustom: form.isCustom,
        isActive: form.isActive,
        allowedMenuKeys: ALL_MENU_KEYS.filter((k) => form.allowedMenuKeys[k]),
      };
      if (creating) return apiClient.post("/admin/plans", { ...payload, code: form.code.trim() });
      return apiClient.put(`/admin/plans/${editing!.id}`, payload);
    },
    onSuccess: () => {
      push({ tone: "success", title: creating ? "Plan created" : "Plan updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      setEditing(null);
      setCreating(false);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function openCreate() {
    setCreating(true);
    setEditing(null);
    setForm(emptyEditForm);
    setError(null);
    setCalcRates(DEFAULT_CALC_RATES);
    setDiscountPercent("0");
    setTagDealerId("");
  }

  function openEdit(plan: Plan) {
    setCreating(false);
    setEditing(plan);
    setForm({
      code: plan.code,
      name: plan.name,
      description: plan.description ?? "",
      billingCycle: plan.billingCycle,
      priceMonthly: plan.priceMonthly,
      maxUsers: String(plan.maxUsers),
      maxStores: String(plan.maxStores),
      maxParts: String(plan.maxParts),
      maxMonthlyTxns: String(plan.maxMonthlyTxns),
      maxExcelUploadRows: String(plan.maxExcelUploadRows),
      maxStorageMb: String(plan.maxStorageMb),
      isCustom: plan.isCustom,
      isActive: plan.isActive,
      allowedMenuKeys: Object.fromEntries(ALL_MENU_KEYS.map((k) => [k, plan.allowedMenuKeys.includes(k)])),
    });
    setError(null);
    setCalcRates(plan.isCustom ? CUSTOM_CALC_RATES : DEFAULT_CALC_RATES);
    setDiscountPercent("0");
    setTagDealerId("");
  }

  const checkedMenuCount = ALL_MENU_KEYS.filter((k) => form.allowedMenuKeys[k]).length;
  const calcMonthly = (Number(calcRates.base) || 0) + (Number(form.maxUsers) || 0) * (Number(calcRates.perUser) || 0) + checkedMenuCount * (Number(calcRates.perMenu) || 0);
  const calcTotal = form.billingCycle === "ANNUAL" ? calcMonthly * 10 : calcMonthly;
  const calcTotalAfterDiscount = calcTotal * (1 - (Number(discountPercent) || 0) / 100);

  // Trial is the automatic 14-day onboarding state every new dealer starts
  // on (see Create Dealer) rather than something a dealer subscribes to —
  // shown separately from the 3 paid tiers a dealer actually picks between.
  const paidPlans = plans?.filter((p) => p.code !== "TRIAL") ?? [];
  const trialPlan = plans?.find((p) => p.code === "TRIAL");

  return (
    <div>
      <PageHeader
        title="Subscription Plans"
        subtitle="Pricing and usage limits for each plan dealers can subscribe to."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Create Plan
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-72 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {paidPlans.map((plan) => (
              <Card key={plan.id}>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-bold text-slate-900 dark:text-slate-100">{plan.name}</p>
                      <p className="mt-0.5 text-2xl font-bold text-brand-600 dark:text-brand-400">
                        {formatCurrency(plan.priceMonthly)}
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500"> /{plan.billingCycle === "ANNUAL" ? "year" : "month"}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">{plan.code}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-1.5">
                        {plan.isCustom && <Badge tone="purple">Custom</Badge>}
                        <Badge tone={plan.isActive ? "success" : "neutral"}>{plan.isActive ? "Active" : "Inactive"}</Badge>
                      </div>
                      <button
                        onClick={() => openEdit(plan)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:text-slate-500 dark:hover:bg-brand-500/15 dark:hover:text-brand-400"
                        title="Edit plan"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {plan.description && <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>}
                  <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs dark:border-navy-800">
                    <IconFieldRow icon={Users} label="Users" value={String(plan.maxUsers)} />
                    <IconFieldRow icon={Store} label="Stores" value={String(plan.maxStores)} />
                    <IconFieldRow icon={Boxes} label="Parts" value={plan.maxParts.toLocaleString("en-IN")} />
                    <IconFieldRow icon={Receipt} label="Txns / month" value={plan.maxMonthlyTxns.toLocaleString("en-IN")} />
                    <IconFieldRow icon={Sheet} label="Excel rows" value={plan.maxExcelUploadRows.toLocaleString("en-IN")} />
                    <IconFieldRow icon={HardDrive} label="Storage" value={`${(plan.maxStorageMb / 1024).toFixed(1)} GB`} />
                    <IconFieldRow
                      icon={ListChecks}
                      label="Menus enabled"
                      value={`${plan.allowedMenuKeys.length} / ${ALL_MENU_KEYS.length}`}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {trialPlan && (
            <Card className="mt-4">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {trialPlan.name} <span className="font-normal text-slate-400 dark:text-slate-500">— automatic for every new dealer, free, 14 days</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {trialPlan.maxUsers} users · {trialPlan.maxStores} store · {trialPlan.maxParts.toLocaleString("en-IN")} parts
                  </p>
                </div>
                <button
                  onClick={() => openEdit(trialPlan)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:text-slate-500 dark:hover:bg-brand-500/15 dark:hover:text-brand-400"
                  title="Edit plan"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog
        open={creating || !!editing}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
        title={creating ? "Create Plan" : `Edit Plan — ${editing?.name ?? ""}`}
        className="max-w-2xl"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button isLoading={save.isPending} onClick={() => { setError(null); save.mutate(); }}>
              {creating ? "Create Plan" : "Save Changes"}
            </Button>
          </>
        }
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto thin-scroll pr-1">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
          {creating && (
            <div>
              <Label>Plan Code</Label>
              <Input
                placeholder="e.g. PRO_ANNUAL or ACME_CUSTOM"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Uppercase letters, numbers and _ only. Can't be changed later.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plan Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Billing Cycle</Label>
              <Select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value as "MONTHLY" | "ANNUAL" })}>
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Price / {form.billingCycle === "ANNUAL" ? "Year" : "Month"} (₹)</Label>
            <Input type="number" min={0} value={form.priceMonthly} onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })} />
          </div>

          <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-3.5 dark:border-brand-500/40 dark:bg-brand-500/5">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-400">
              <Calculator className="h-3.5 w-3.5" /> Pricing calculator
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <Label className="text-xs">Base price (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={form.isCustom}
                  value={calcRates.base}
                  onChange={(e) => setCalcRates({ ...calcRates, base: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Per user (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={form.isCustom}
                  value={calcRates.perUser}
                  onChange={(e) => setCalcRates({ ...calcRates, perUser: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Per menu (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={form.isCustom}
                  value={calcRates.perMenu}
                  onChange={(e) => setCalcRates({ ...calcRates, perMenu: e.target.value })}
                />
              </div>
            </div>
            {form.isCustom && (
              <p className="mt-1.5 text-[11px] text-brand-600 dark:text-brand-400">Rates are fixed for Custom plans and can't be changed here.</p>
            )}
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              Uses Max Users and Menus Allowed below — {form.maxUsers || 0} users, {checkedMenuCount} of {ALL_MENU_KEYS.length} menus checked.
            </p>

            {form.isCustom && (
              <div className="mt-2.5">
                <Label className="text-xs">Final discount (%)</Label>
                <Input type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
              </div>
            )}

            <div className="mt-2.5 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-navy-700 dark:bg-navy-900">
              <div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {form.isCustom && Number(discountPercent) > 0 ? "Suggested price (after discount)" : "Suggested price"}
                </p>
                {form.isCustom && Number(discountPercent) > 0 && (
                  <p className="text-[11px] text-slate-400 line-through dark:text-slate-500">{formatCurrency(calcTotal)}</p>
                )}
                <p className="text-sm font-bold tabular-nums text-brand-600 dark:text-brand-400">
                  {formatCurrency(calcTotalAfterDiscount)} / {form.billingCycle === "ANNUAL" ? "year" : "month"}
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, priceMonthly: String(Math.round(calcTotalAfterDiscount)) })}>
                <ArrowDown className="h-3.5 w-3.5" /> Use this price
              </Button>
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Max Users</Label>
              <Input type="number" min={1} value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: e.target.value })} />
            </div>
            <div>
              <Label>Max Stores</Label>
              <Input type="number" min={1} value={form.maxStores} onChange={(e) => setForm({ ...form, maxStores: e.target.value })} />
            </div>
            <div>
              <Label>Max Parts</Label>
              <Input type="number" min={1} value={form.maxParts} onChange={(e) => setForm({ ...form, maxParts: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Max Txns / Month</Label>
              <Input type="number" min={1} value={form.maxMonthlyTxns} onChange={(e) => setForm({ ...form, maxMonthlyTxns: e.target.value })} />
            </div>
            <div>
              <Label>Max Excel Upload Rows</Label>
              <Input type="number" min={1} value={form.maxExcelUploadRows} onChange={(e) => setForm({ ...form, maxExcelUploadRows: e.target.value })} />
            </div>
            <div>
              <Label>Max Storage (MB)</Label>
              <Input type="number" min={1} value={form.maxStorageMb} onChange={(e) => setForm({ ...form, maxStorageMb: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-navy-600"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active (selectable when onboarding a new dealer)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-navy-600"
              checked={form.isCustom}
              onChange={(e) => {
                const isCustom = e.target.checked;
                setForm({ ...form, isCustom });
                setCalcRates(isCustom ? CUSTOM_CALC_RATES : DEFAULT_CALC_RATES);
                if (!isCustom) setDiscountPercent("0");
              }}
            />
            Custom plan (hidden from the dealer self-service plan screen — assign it directly from a dealer's profile instead)
          </label>

          {!creating && form.isCustom && (
            <div className="rounded-xl border border-dashed border-purple-300 bg-purple-50/40 p-3.5 dark:border-purple-500/40 dark:bg-purple-500/5">
              <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-purple-700 dark:text-purple-400">Tag to dealer</p>
              <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">Assign this custom plan directly to a dealer.</p>
              <div className="flex gap-2">
                <Select className="flex-1" value={tagDealerId} onChange={(e) => setTagDealerId(e.target.value)}>
                  <option value="">Select a dealer…</option>
                  {dealers?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.dealerCode})
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!tagDealerId}
                  isLoading={tagToDealer.isPending}
                  onClick={() => tagToDealer.mutate()}
                >
                  Tag
                </Button>
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4 dark:border-navy-800">
            <p className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Features &amp; Menus Allowed</p>
            <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
              A menu unchecked here is hidden for every user of a dealer on this plan — even one a role or an explicit per-user grant would normally show.
            </p>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Primary Tabs</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PRIMARY_TABS.map((tab) => (
                    <label key={tab.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-navy-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-navy-600"
                        checked={form.allowedMenuKeys[tab.key] ?? false}
                        onChange={(e) => setForm({ ...form, allowedMenuKeys: { ...form.allowedMenuKeys, [tab.key]: e.target.checked } })}
                      />
                      <span className="truncate">{tab.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {MORE_MENU_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{group.label}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {group.items.map((item) => (
                      <label key={item.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-navy-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-navy-600"
                          checked={form.allowedMenuKeys[item.key] ?? false}
                          onChange={(e) => setForm({ ...form, allowedMenuKeys: { ...form.allowedMenuKeys, [item.key]: e.target.checked } })}
                        />
                        <span className="truncate">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Users, Store, Boxes, Receipt, Sheet, HardDrive } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { Plan } from "@/types";
import { PageHeader } from "@/components/ui/Feedback";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { IconFieldRow } from "@/components/ui/IconFieldRow";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";

const emptyEditForm = {
  name: "",
  description: "",
  priceMonthly: "0",
  maxUsers: "1",
  maxStores: "1",
  maxParts: "1",
  maxMonthlyTxns: "1",
  maxExcelUploadRows: "1",
  maxStorageMb: "1",
  isActive: true,
};

export function PlansPage() {
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(emptyEditForm);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();
  const queryClient = useQueryClient();

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => (await apiClient.get<{ data: Plan[] }>("/admin/plans")).data.data,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description.trim() || null,
        priceMonthly: Number(form.priceMonthly),
        maxUsers: Number(form.maxUsers),
        maxStores: Number(form.maxStores),
        maxParts: Number(form.maxParts),
        maxMonthlyTxns: Number(form.maxMonthlyTxns),
        maxExcelUploadRows: Number(form.maxExcelUploadRows),
        maxStorageMb: Number(form.maxStorageMb),
        isActive: form.isActive,
      };
      return apiClient.put(`/admin/plans/${editing!.id}`, payload);
    },
    onSuccess: () => {
      push({ tone: "success", title: "Plan updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      setEditing(null);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function openEdit(plan: Plan) {
    setEditing(plan);
    setForm({
      name: plan.name,
      description: plan.description ?? "",
      priceMonthly: plan.priceMonthly,
      maxUsers: String(plan.maxUsers),
      maxStores: String(plan.maxStores),
      maxParts: String(plan.maxParts),
      maxMonthlyTxns: String(plan.maxMonthlyTxns),
      maxExcelUploadRows: String(plan.maxExcelUploadRows),
      maxStorageMb: String(plan.maxStorageMb),
      isActive: plan.isActive,
    });
    setError(null);
  }

  // Trial is the automatic 14-day onboarding state every new dealer starts
  // on (see Create Dealer) rather than something a dealer subscribes to —
  // shown separately from the 3 paid tiers a dealer actually picks between.
  const paidPlans = plans?.filter((p) => p.code !== "TRIAL") ?? [];
  const trialPlan = plans?.find((p) => p.code === "TRIAL");

  return (
    <div>
      <PageHeader title="Subscription Plans" subtitle="Pricing and usage limits for each plan dealers can subscribe to." />

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
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500"> /month</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge tone={plan.isActive ? "success" : "neutral"}>{plan.isActive ? "Active" : "Inactive"}</Badge>
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
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title={`Edit Plan — ${editing?.name ?? ""}`}
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button isLoading={save.isPending} onClick={() => { setError(null); save.mutate(); }}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plan Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Price / Month (₹)</Label>
              <Input type="number" min={0} value={form.priceMonthly} onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })} />
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
        </div>
      </Dialog>
    </div>
  );
}

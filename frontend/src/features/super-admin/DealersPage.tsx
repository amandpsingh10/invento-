import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Pencil, Plus, Power, PowerOff, Users } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { DealerTenant } from "@/types";
import { PageHeader } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/branding";

const emptyForm = {
  dealerCode: "",
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  planCode: "TRIAL",
  adminFirstName: "",
  adminLastName: "",
  adminEmail: "",
  adminMobile: "",
  adminPassword: "",
};

const STATUS_TONE: Record<string, any> = { TRIAL: "info", ACTIVE: "success", SUSPENDED: "warning", CANCELLED: "danger" };

const emptyEditForm = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  status: "TRIAL",
};

export function DealersPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [editTenant, setEditTenant] = useState<DealerTenant | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState<string | null>(null);
  const { push } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: async () => (await apiClient.get<{ data: DealerTenant[] }>("/admin/tenants")).data.data,
  });

  const create = useMutation({
    mutationFn: async () => apiClient.post("/admin/tenants", form),
    onSuccess: () => {
      push({ tone: "success", title: "Dealer created" });
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, activate }: { id: string; activate: boolean }) =>
      apiClient.put(`/admin/tenants/${id}/${activate ? "activate" : "deactivate"}`),
    onSuccess: () => {
      push({ tone: "success", title: "Dealer status updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
    onError: (err) => push({ tone: "error", title: "Failed", description: getApiErrorMessage(err) }),
  });

  const openEdit = (t: DealerTenant) => {
    setEditTenant(t);
    setEditForm({
      name: t.name,
      contactPerson: t.contactPerson ?? "",
      email: t.email ?? "",
      phone: t.phone ?? "",
      address: t.address ?? "",
      status: t.status,
    });
    setEditError(null);
  };

  const update = useMutation({
    mutationFn: async () => {
      const { name, contactPerson, email, phone, address, status } = editForm;
      const payload = {
        name,
        contactPerson: contactPerson.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        status,
      };
      return apiClient.put(`/admin/tenants/${editTenant!.id}`, payload);
    },
    onSuccess: () => {
      push({ tone: "success", title: "Dealer updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      setEditTenant(null);
    },
    onError: (err) => setEditError(getApiErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Dealers"
        subtitle={`Onboard and manage dealerships on the ${PRODUCT_NAME} platform.`}
        actions={
          <Button size="sm" onClick={() => { setForm(emptyForm); setError(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Create Dealer
          </Button>
        }
      />

      <Card>
        <DataTable<DealerTenant>
          isLoading={isLoading}
          items={data ?? []}
          rowKey={(t) => t.id}
          emptyTitle="No dealers yet"
          columns={
            [
              { header: "Name", render: (t) => <span className="font-medium text-slate-800 dark:text-slate-200">{t.name}</span> },
              { header: "Dealer Code", render: (t) => <span className="font-mono text-xs">{t.dealerCode}</span> },
              { header: "Plan", render: (t) => t.plan ?? "—" },
              { header: "Status", render: (t) => <Badge tone={STATUS_TONE[t.status] ?? "neutral"}>{t.status}</Badge> },
              { header: "Users", align: "right", render: (t) => t.userCount },
              { header: "Created", render: (t) => formatDate(t.createdAt) },
              {
                header: "Actions",
                align: "right",
                render: (t) => (
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      to={`/super-admin/dealers/${t.id}/users`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:text-slate-500 dark:hover:bg-brand-500/15 dark:hover:text-brand-400"
                      title="Users & Menu Access"
                    >
                      <Users className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => openEdit(t)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:text-slate-500 dark:hover:bg-brand-500/15 dark:hover:text-brand-400"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {t.status === "SUSPENDED" ? (
                      <button
                        onClick={() => toggleStatus.mutate({ id: t.id, activate: true })}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:text-slate-500 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                        title="Activate"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleStatus.mutate({ id: t.id, activate: false })}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        title="Deactivate"
                      >
                        <PowerOff className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ),
              },
            ] satisfies DataColumn<DealerTenant>[]
          }
        />
      </Card>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Create Dealer"
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button isLoading={create.isPending} onClick={() => { setError(null); create.mutate(); }}>
              Create Dealer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Dealer Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dealer Code</Label>
                <Input placeholder="e.g. ACME001" value={form.dealerCode} onChange={(e) => setForm({ ...form, dealerCode: e.target.value })} />
              </div>
              <div>
                <Label>Dealer Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Contact Person</Label>
                <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Plan</Label>
                <Select value={form.planCode} onChange={(e) => setForm({ ...form, planCode: e.target.value })}>
                  <option value="TRIAL">Trial</option>
                  <option value="BASIC">Basic</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Initial Tenant Admin</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name</Label>
                <Input value={form.adminFirstName} onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })} />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={form.adminLastName} onChange={(e) => setForm({ ...form, adminLastName: e.target.value })} />
              </div>
              <div>
                <Label>Admin Email</Label>
                <Input type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
              </div>
              <div>
                <Label>Admin Mobile Number</Label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="9876543210"
                  value={form.adminMobile}
                  onChange={(e) => setForm({ ...form, adminMobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                />
              </div>
              <div>
                <Label>Temporary Password</Label>
                <Input type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
              </div>
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!editTenant}
        onOpenChange={(v) => { if (!v) setEditTenant(null); }}
        title={`Edit Dealer${editTenant ? ` — ${editTenant.dealerCode}` : ""}`}
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditTenant(null)}>
              Cancel
            </Button>
            <Button isLoading={update.isPending} onClick={() => { setEditError(null); update.mutate(); }}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{editError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dealer Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Contact Person</Label>
              <Input value={editForm.contactPerson} onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="TRIAL">Trial</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

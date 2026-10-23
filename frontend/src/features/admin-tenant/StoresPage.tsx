import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Store as StoreIcon, MapPin } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { Store } from "@/types";
import { PageHeader } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { IconFieldRow } from "@/components/ui/IconFieldRow";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";

const emptyForm = { code: "", name: "", address: "", status: "ACTIVE" as "ACTIVE" | "INACTIVE" };

function StoreMobileCard({ s, onEdit }: { s: Store; onEdit: () => void }) {
  return (
    <button onClick={onEdit} className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:scale-[0.99] dark:border-navy-700 dark:bg-navy-900">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <StoreIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-base font-bold text-slate-900 dark:text-slate-100" title={s.name}>
              {s.name}
            </p>
            <Badge tone={s.status === "ACTIVE" ? "success" : "neutral"} className="shrink-0">{s.status}</Badge>
          </div>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400" title={s.code}>
            {s.code}
          </p>
        </div>
        <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
      </div>
      {s.address && (
        <div className="mt-3">
          <IconFieldRow icon={MapPin} label="Address" value={s.address} />
        </div>
      )}
    </button>
  );
}

export function StoresPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => (await apiClient.get<{ data: Store[] }>("/stores")).data.data,
  });

  const save = useMutation({
    mutationFn: async () => (editing ? apiClient.put(`/stores/${editing.id}`, form) : apiClient.post("/stores", form)),
    onSuccess: () => {
      push({ tone: "success", title: editing ? "Store updated" : "Store created" });
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      closeDialog();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setOpen(true);
  }
  function openEdit(store: Store) {
    setEditing(store);
    setForm({ code: store.code, name: store.name, address: store.address ?? "", status: store.status });
    setError(null);
    setOpen(true);
  }
  function closeDialog() {
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Stores"
        subtitle="Physical store locations for this dealership."
        breadcrumbs={["Administration", "Stores"]}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Store
          </Button>
        }
      />

      <Card>
        <DataTable<Store>
          isLoading={isLoading}
          items={data ?? []}
          rowKey={(s) => s.id}
          emptyTitle="No stores yet"
          emptyAction={<Button size="sm" onClick={openCreate}>Add Store</Button>}
          renderMobileCard={(s) => <StoreMobileCard s={s} onEdit={() => openEdit(s)} />}
          columns={
            [
              { header: "Code", render: (s) => <span className="font-medium text-slate-800 dark:text-slate-200">{s.code}</span> },
              { header: "Name", render: (s) => s.name },
              { header: "Address", render: (s) => s.address ?? "—" },
              { header: "Status", render: (s) => <Badge tone={s.status === "ACTIVE" ? "success" : "neutral"}>{s.status}</Badge> },
              {
                header: "Actions",
                align: "right",
                render: (s) => (
                  <button onClick={() => openEdit(s)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-navy-800 dark:hover:text-slate-300">
                    <Pencil className="h-4 w-4" />
                  </button>
                ),
              },
            ] satisfies DataColumn<Store>[]
          }
        />
      </Card>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Store" : "Add Store"}
        footer={
          <>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button isLoading={save.isPending} onClick={() => { setError(null); save.mutate(); }}>
              {editing ? "Save Changes" : "Create Store"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
          <div>
            <Label>Store Code</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div>
            <Label>Store Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Address</Label>
            <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

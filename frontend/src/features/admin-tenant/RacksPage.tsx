import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Rows3, Store as StoreIcon } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { Rack, Store } from "@/types";
import { PageHeader } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { IconFieldRow } from "@/components/ui/IconFieldRow";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";

const emptyForm = { storeId: "", code: "", status: "ACTIVE" as "ACTIVE" | "INACTIVE" };

function RackMobileCard({ r, onEdit }: { r: Rack; onEdit: () => void }) {
  return (
    <button onClick={onEdit} className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:scale-[0.99] dark:border-navy-700 dark:bg-navy-900">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
          <Rows3 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-base font-bold text-slate-900 dark:text-slate-100" title={r.code}>
              {r.code}
            </p>
            <Badge tone={r.status === "ACTIVE" ? "success" : "neutral"} className="shrink-0">{r.status}</Badge>
          </div>
        </div>
        <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
      </div>
      <div className="mt-3">
        <IconFieldRow icon={StoreIcon} label="Store" value={r.store?.name ?? "—"} />
      </div>
    </button>
  );
}

export function RacksPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rack | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();
  const queryClient = useQueryClient();

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => (await apiClient.get<{ data: Store[] }>("/stores")).data.data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["racks"],
    queryFn: async () => (await apiClient.get<{ data: Rack[] }>("/racks")).data.data,
  });

  const save = useMutation({
    mutationFn: async () => (editing ? apiClient.put(`/racks/${editing.id}`, form) : apiClient.post("/racks", form)),
    onSuccess: () => {
      push({ tone: "success", title: editing ? "Rack updated" : "Rack created" });
      queryClient.invalidateQueries({ queryKey: ["racks"] });
      setOpen(false);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, storeId: stores?.[0]?.id ?? "" });
    setError(null);
    setOpen(true);
  }
  function openEdit(rack: Rack) {
    setEditing(rack);
    setForm({ storeId: rack.storeId, code: rack.code, status: rack.status });
    setError(null);
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Racks"
        subtitle="Storage racks within each store."
        breadcrumbs={["Administration", "Racks"]}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Rack
          </Button>
        }
      />
      <Card>
        <DataTable<Rack>
          isLoading={isLoading}
          items={data ?? []}
          rowKey={(r) => r.id}
          emptyTitle="No racks yet"
          renderMobileCard={(r) => <RackMobileCard r={r} onEdit={() => openEdit(r)} />}
          columns={
            [
              { header: "Rack Code", render: (r) => <span className="font-medium text-slate-800 dark:text-slate-200">{r.code}</span> },
              { header: "Store", render: (r) => r.store?.name },
              { header: "Status", render: (r) => <Badge tone={r.status === "ACTIVE" ? "success" : "neutral"}>{r.status}</Badge> },
              {
                header: "Actions",
                align: "right",
                render: (r) => (
                  <button onClick={() => openEdit(r)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-navy-800 dark:hover:text-slate-300">
                    <Pencil className="h-4 w-4" />
                  </button>
                ),
              },
            ] satisfies DataColumn<Rack>[]
          }
        />
      </Card>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Rack" : "Add Rack"}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button isLoading={save.isPending} onClick={() => { setError(null); save.mutate(); }}>
              {editing ? "Save Changes" : "Create Rack"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
          <div>
            <Label>Store</Label>
            <Select value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })}>
              {stores?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Rack Code</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
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

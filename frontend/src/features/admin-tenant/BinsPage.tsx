import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Box, Store as StoreIcon } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { Bin, Store } from "@/types";
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

function BinMobileCard({ b, onEdit }: { b: Bin; onEdit: () => void }) {
  return (
    <button onClick={onEdit} className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:scale-[0.99] dark:border-navy-700 dark:bg-navy-900">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
          <Box className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-base font-bold text-slate-900 dark:text-slate-100" title={b.code}>
              {b.code}
            </p>
            <Badge tone={b.status === "ACTIVE" ? "success" : "neutral"} className="shrink-0">{b.status}</Badge>
          </div>
        </div>
        <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
      </div>
      <div className="mt-3">
        <IconFieldRow icon={StoreIcon} label="Store" value={b.store?.name ?? "—"} />
      </div>
    </button>
  );
}

export function BinsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bin | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();
  const queryClient = useQueryClient();

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => (await apiClient.get<{ data: Store[] }>("/stores")).data.data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["bins"],
    queryFn: async () => (await apiClient.get<{ data: Bin[] }>("/bins")).data.data,
  });

  const save = useMutation({
    mutationFn: async () => (editing ? apiClient.put(`/bins/${editing.id}`, form) : apiClient.post("/bins", form)),
    onSuccess: () => {
      push({ tone: "success", title: editing ? "Bin updated" : "Bin created" });
      queryClient.invalidateQueries({ queryKey: ["bins"] });
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
  function openEdit(bin: Bin) {
    setEditing(bin);
    setForm({ storeId: bin.storeId, code: bin.code, status: bin.status });
    setError(null);
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Bins"
        subtitle="Storage bins within each store."
        breadcrumbs={["Administration", "Bins"]}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Bin
          </Button>
        }
      />
      <Card>
        <DataTable<Bin>
          isLoading={isLoading}
          items={data ?? []}
          rowKey={(b) => b.id}
          emptyTitle="No bins yet"
          renderMobileCard={(b) => <BinMobileCard b={b} onEdit={() => openEdit(b)} />}
          columns={
            [
              { header: "Bin Code", render: (b) => <span className="font-medium text-slate-800 dark:text-slate-200">{b.code}</span> },
              { header: "Store", render: (b) => b.store?.name },
              { header: "Status", render: (b) => <Badge tone={b.status === "ACTIVE" ? "success" : "neutral"}>{b.status}</Badge> },
              {
                header: "Actions",
                align: "right",
                render: (b) => (
                  <button onClick={() => openEdit(b)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-navy-800 dark:hover:text-slate-300">
                    <Pencil className="h-4 w-4" />
                  </button>
                ),
              },
            ] satisfies DataColumn<Bin>[]
          }
        />
      </Card>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Bin" : "Add Bin"}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button isLoading={save.isPending} onClick={() => { setError(null); save.mutate(); }}>
              {editing ? "Save Changes" : "Create Bin"}
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
            <Label>Bin Code</Label>
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

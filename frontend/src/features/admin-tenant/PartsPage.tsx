import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Search, ScanLine, Upload, Tag, Package, Barcode, Percent, Coins, Ruler, FileText, Layers } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { PagedResult, Part } from "@/types";
import { PageHeader, Pagination } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { IconFieldRow } from "@/components/ui/IconFieldRow";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { scanBarcode } from "@/lib/barcodeScanner";
import { previewPricing } from "@/lib/pricing";
import { PART_CATEGORIES, PART_CATEGORY_LABELS, PART_CATEGORY_STORE_HINT, type PartCategoryCode } from "@/lib/partCategory";

const UNITS = ["NOS", "LTR", "ML", "KGS"] as const;

function PartMobileCard({ p, onEdit }: { p: Part; onEdit: () => void }) {
  return (
    <button onClick={onEdit} className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:scale-[0.99] dark:border-navy-700 dark:bg-navy-900">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-navy-800 dark:text-slate-500">
          <Package className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-base font-bold text-slate-900 dark:text-slate-100" title={p.description}>
              {p.description}
            </p>
            <Badge tone={p.status === "ACTIVE" ? "success" : "neutral"} className="shrink-0">{p.status}</Badge>
          </div>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400" title={p.partNo}>
            {p.partNo}
          </p>
          <CategoryBadge category={p.category} className="mt-1" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <IconFieldRow icon={Ruler} label="Unit" value={p.unit ?? "NOS"} />
        <IconFieldRow icon={Barcode} label="Barcode" value={p.barcode || "—"} />
        <IconFieldRow icon={FileText} label="HSN Code" value={p.hsnCode || "—"} />
        <IconFieldRow icon={Layers} label="Min. Stock" value={String(p.minimumStockLevel)} />
        <IconFieldRow icon={Percent} label="Tax %" value={`${p.taxPercent}%`} />
        <IconFieldRow icon={Coins} label="MRP" value={formatCurrency(p.mrp)} emphasize />
        <IconFieldRow icon={Coins} label="NDP" value={formatCurrency(p.ndp)} />
      </div>
    </button>
  );
}

const emptyForm = {
  partNo: "",
  description: "",
  taxPercent: "0",
  hsnCode: "",
  ndp: "0",
  dealerMarginPercent: "0",
  unit: "NOS" as (typeof UNITS)[number],
  barcode: "",
  category: "P" as PartCategoryCode,
  minimumStockLevel: "0",
  status: "ACTIVE" as "ACTIVE" | "INACTIVE",
};

export function PartsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["parts-admin", { search, category, page }],
    queryFn: async () =>
      (
        await apiClient.get<{ data: PagedResult<Part> }>("/parts", {
          params: { search: search || undefined, category: category || undefined, page, pageSize: 20 },
        })
      ).data.data,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        taxPercent: Number(form.taxPercent),
        ndp: Number(form.ndp),
        dealerMarginPercent: form.dealerMarginPercent.trim() === "" ? 0 : Number(form.dealerMarginPercent),
        minimumStockLevel: Number(form.minimumStockLevel),
      };
      return editing ? apiClient.put(`/parts/${editing.id}`, payload) : apiClient.post("/parts", payload);
    },
    onSuccess: () => {
      push({ tone: "success", title: editing ? "Part updated" : "Part created" });
      queryClient.invalidateQueries({ queryKey: ["parts-admin"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setOpen(false);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  async function handleScan() {
    const result = await scanBarcode();
    if (result.status === "scanned") {
      setForm((f) => ({ ...f, barcode: result.value }));
    } else if (result.status === "unsupported") {
      push({ tone: "info", title: "Not supported here", description: "Barcode scanning only works in the Android app." });
    } else if (result.status === "permission-denied") {
      push({ tone: "error", title: "Camera permission needed", description: "Allow camera access in the app settings to scan a barcode." });
    } else if (result.status === "error") {
      push({ tone: "error", title: "Unable to scan", description: result.message });
    }
    // "cancelled" (user backed out of the scanner) — no toast needed.
  }

  // List Price and MRP are shown read-only and recomputed by the backend on
  // save. An existing part whose pricing inputs haven't been touched keeps
  // showing its stored MRP, because parts saved before this rule can differ
  // from NDP × margin × tax by a paisa of rounding — the backend likewise
  // leaves MRP alone unless NDP, margin or tax actually change.
  const pricing = previewPricing(form.ndp, form.dealerMarginPercent, form.taxPercent);
  const pricingUntouched =
    !!editing &&
    Number(form.ndp) === Number(editing.ndp) &&
    Number(form.dealerMarginPercent || 0) === Number(editing.dealerMarginPercent ?? 0) &&
    Number(form.taxPercent) === Number(editing.taxPercent);
  const displayMrp = pricingUntouched ? Number(editing!.mrp) : pricing?.mrp ?? null;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setOpen(true);
  }
  function openEdit(part: Part) {
    setEditing(part);
    setForm({
      partNo: part.partNo,
      description: part.description,
      taxPercent: part.taxPercent,
      hsnCode: part.hsnCode ?? "",
      ndp: part.ndp,
      dealerMarginPercent: part.dealerMarginPercent ?? "0",
      unit: (part.unit as (typeof UNITS)[number]) ?? "NOS",
      barcode: part.barcode ?? "",
      category: (part.category as PartCategoryCode) ?? "P",
      minimumStockLevel: String(part.minimumStockLevel),
      status: part.status,
    });
    setError(null);
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Parts"
        subtitle="Part master data — pricing, tax and reorder thresholds."
        breadcrumbs={["Administration", "Parts"]}
        actions={
          <>
            <Link to="/admin-tenant/parts/bulk-upload">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4" /> Bulk Upload
              </Button>
            </Link>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Part
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-navy-800">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Search Part No or Description..."
              className="rounded-full pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="relative">
            <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-52 rounded-full pl-9"
            >
              <option value="">All Categories</option>
              {PART_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PART_CATEGORY_LABELS[c]} ({c})
                </option>
              ))}
            </Select>
          </div>
        </div>
        <DataTable<Part>
          isLoading={isLoading}
          items={data?.items ?? []}
          rowKey={(p) => p.id}
          emptyTitle="No parts yet"
          emptyDescription="Parts are also created automatically when you import a purchase Excel file."
          renderMobileCard={(p) => <PartMobileCard p={p} onEdit={() => openEdit(p)} />}
          columns={
            [
              { header: "Part No", render: (p) => <span className="font-medium text-slate-800 dark:text-slate-200">{p.partNo}</span> },
              { header: "Description", render: (p) => p.description },
              { header: "Unit", render: (p) => p.unit ?? "NOS" },
              {
                header: "Category",
                render: (p) => {
                  const code = (p.category as PartCategoryCode) ?? "P";
                  return (
                    <Badge tone="neutral">
                      {code} — {PART_CATEGORY_LABELS[code] ?? code}
                    </Badge>
                  );
                },
              },
              { header: "Barcode", render: (p) => p.barcode || "—" },
              { header: "HSN Code", render: (p) => p.hsnCode || "—" },
              { header: "Tax %", align: "right", render: (p) => `${p.taxPercent}%` },
              { header: "MRP", align: "right", render: (p) => formatCurrency(p.mrp) },
              { header: "NDP", align: "right", render: (p) => formatCurrency(p.ndp) },
              { header: "Min. Stock", align: "right", render: (p) => p.minimumStockLevel },
              { header: "Status", render: (p) => <Badge tone={p.status === "ACTIVE" ? "success" : "neutral"}>{p.status}</Badge> },
              {
                header: "Actions",
                align: "right",
                render: (p) => (
                  <button onClick={() => openEdit(p)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-navy-800 dark:hover:text-slate-300">
                    <Pencil className="h-4 w-4" />
                  </button>
                ),
              },
            ] satisfies DataColumn<Part>[]
          }
        />
        {data && data.total > 0 && (
          <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={20} onPageChange={setPage} />
        )}
      </Card>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Part" : "Add Part"}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button isLoading={save.isPending} onClick={() => { setError(null); save.mutate(); }}>
              {editing ? "Save Changes" : "Create Part"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
          <div>
            <Label>Part No</Label>
            <Input value={form.partNo} onChange={(e) => setForm({ ...form, partNo: e.target.value })} />
          </div>
          <div>
            <Label>Part Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tax %</Label>
              <Input type="number" min={0} max={100} value={form.taxPercent} onChange={(e) => setForm({ ...form, taxPercent: e.target.value })} />
            </div>
            <div>
              <Label>HSN Code</Label>
              <Input value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>NDP (Without Tax)</Label>
              <Input type="number" min={0} value={form.ndp} onChange={(e) => setForm({ ...form, ndp: e.target.value })} />
            </div>
            <div>
              <Label>Dealer Margin %</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={form.dealerMarginPercent}
                onChange={(e) => setForm({ ...form, dealerMarginPercent: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>List Price</Label>
              <Input
                readOnly
                disabled
                value={pricing ? formatCurrency(pricing.listPrice) : ""}
                placeholder="NDP + Dealer Margin %"
                className="cursor-not-allowed bg-slate-50 text-slate-600 dark:bg-navy-800 dark:text-slate-300"
              />
            </div>
            <div>
              <Label>MRP (Incl. Tax)</Label>
              <Input
                readOnly
                disabled
                value={displayMrp !== null ? formatCurrency(displayMrp) : ""}
                placeholder="List Price + Tax %"
                className="cursor-not-allowed bg-slate-50 text-slate-600 dark:bg-navy-800 dark:text-slate-300"
              />
            </div>
            <p className="col-span-2 -mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Calculated automatically: List Price = NDP + Dealer Margin %, then MRP = List Price + Tax %.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unit</Label>
              <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as (typeof UNITS)[number] })}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Only ML, LTR and KGS allow decimal quantities.</p>
            </div>
            <div>
              <Label>Minimum Stock Level</Label>
              <Input type="number" min={0} value={form.minimumStockLevel} onChange={(e) => setForm({ ...form, minimumStockLevel: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Barcode</Label>
            <div className="flex gap-2">
              <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Scan or type a barcode" />
              <Button type="button" variant="outline" size="icon" onClick={handleScan} title="Scan barcode">
                <ScanLine className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as PartCategoryCode })}>
              {PART_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PART_CATEGORY_LABELS[c]} ({c})
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Typically stocked in Store {PART_CATEGORY_STORE_HINT[form.category]}.</p>
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

import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackagePlus, ScanLine, Search } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { Bin, Rack, Store, PagedResult, Part } from "@/types";
import { PageHeader } from "@/components/ui/Feedback";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { PortalDropdown } from "@/components/ui/PortalDropdown";
import { useToast } from "@/components/ui/Toast";
import { previewPricing } from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";
import { PART_UNITS, unitAllowsDecimalQuantity } from "@/lib/quantity";
import { scanBarcode } from "@/lib/barcodeScanner";

const emptyForm = {
  invoiceNo: "",
  partNo: "",
  partDescription: "",
  taxPercent: "",
  hsnCode: "",
  ndp: "",
  dealerMarginPercent: "",
  quantity: "",
  unit: "NOS",
  storeCode: "",
  binCode: "",
  rackCode: "",
};

export function ManualEntryPage() {
  const [form, setForm] = useState(emptyForm);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);
  const partNoAnchorRef = useRef<HTMLDivElement>(null);
  const { push } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: partMatches } = useQuery({
    queryKey: ["parts-search-manual-entry", form.partNo],
    queryFn: async () => (await apiClient.get<{ data: PagedResult<Part> }>("/parts", { params: { search: form.partNo, pageSize: 8 } })).data.data,
    enabled: partSearchOpen && form.partNo.trim().length > 0,
  });

  const isDirty = useMemo(() => Object.values(form).some((v) => v !== ""), [form]);

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => (await apiClient.get<{ data: Store[] }>("/stores")).data.data,
  });
  const { data: bins } = useQuery({
    queryKey: ["bins", selectedStoreId],
    queryFn: async () => (await apiClient.get<{ data: Bin[] }>("/bins", { params: { storeId: selectedStoreId } })).data.data,
    enabled: !!selectedStoreId,
  });
  const { data: racks } = useQuery({
    queryKey: ["racks", selectedStoreId],
    queryFn: async () => (await apiClient.get<{ data: Rack[] }>("/racks", { params: { storeId: selectedStoreId } })).data.data,
    enabled: !!selectedStoreId,
  });

  // The user enters NDP (and an optional dealer margin %); List Price and
  // MRP are shown read-only. The backend recomputes both independently
  // (source of truth) — this is display-only.
  const pricing = previewPricing(form.ndp, form.dealerMarginPercent, form.taxPercent);

  const submit = useMutation({
    mutationFn: async () => apiClient.post("/purchases/manual", form),
    onSuccess: (res) => {
      push({ tone: "success", title: "Part added successfully", description: `Purchase ${res.data.data.purchase.purchaseNumber} recorded.` });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["parts-admin"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setForm(emptyForm);
      navigate("/inventory/current-stock");
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const selectedStore = stores?.find((s) => s.id === selectedStoreId);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Shared by both entry points that can resolve a master Part record —
  // typing/selecting from the Part No search dropdown, and a barcode scan
  // match. Prefills everything but Quantity/Store/Bin/Rack, since this
  // screen is for recording a purchase against an already-known part.
  function applyPartMatch(match: Part) {
    setForm((f) => ({
      ...f,
      partNo: match.partNo,
      partDescription: match.description,
      taxPercent: match.taxPercent,
      hsnCode: match.hsnCode ?? "",
      ndp: match.ndp,
      dealerMarginPercent: match.dealerMarginPercent,
      unit: match.unit ?? "NOS",
    }));
    setPartSearchOpen(false);
  }

  async function handleScan() {
    const result = await scanBarcode();
    if (result.status !== "scanned") {
      if (result.status === "unsupported") {
        push({ tone: "info", title: "Not supported here", description: "Barcode scanning only works in the Android app." });
      } else if (result.status === "permission-denied") {
        push({ tone: "error", title: "Camera permission needed", description: "Allow camera access in the app settings to scan a barcode." });
      } else if (result.status === "error") {
        push({ tone: "error", title: "Unable to scan", description: result.message });
      }
      return;
    }

    try {
      const res = await apiClient.get<{ data: PagedResult<Part> }>("/parts", { params: { search: result.value, pageSize: 1 } });
      const match = res.data.data.items[0];
      if (match) {
        applyPartMatch(match);
        push({ tone: "success", title: "Part found", description: `Prefilled from existing part ${match.partNo}.` });
      } else {
        update("partNo", result.value);
        push({ tone: "info", title: "New barcode", description: "No existing part matches — Part No has been prefilled, fill in the rest." });
      }
    } catch {
      update("partNo", result.value);
    }
  }

  function handleBack() {
    if (isDirty) {
      setLeaveConfirmOpen(true);
    } else {
      navigate(-1);
    }
  }

  return (
    <div className="pb-32 sm:pb-0">
      <PageHeader
        title="Add Part"
        subtitle="Manually add purchased inventory — same fields and validation as the Excel upload."
        breadcrumbs={["Inventory", "Add Part"]}
        onBack={handleBack}
      />

      <Card>
        <CardContent className="space-y-4 p-5">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{error}</div>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Invoice No *</Label>
              <Input placeholder="INV-10001" value={form.invoiceNo} onChange={(e) => update("invoiceNo", e.target.value)} />
            </div>
            <div>
              <Label>Part No *</Label>
              <div ref={partNoAnchorRef} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input
                    className="pl-9"
                    placeholder="BRK-PAD-001"
                    value={form.partNo}
                    onChange={(e) => {
                      update("partNo", e.target.value);
                      setPartSearchOpen(true);
                    }}
                    onFocus={() => setPartSearchOpen(true)}
                  />
                </div>
                <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={handleScan} title="Scan barcode">
                  <ScanLine className="h-4 w-4" />
                </Button>
              </div>
              <PortalDropdown anchorRef={partNoAnchorRef} open={partSearchOpen && form.partNo.trim().length > 0} onClose={() => setPartSearchOpen(false)}>
                {partMatches?.items.length ? (
                  partMatches.items.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyPartMatch(p)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-navy-800"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800 dark:text-slate-200" title={p.partNo}>
                          {p.partNo}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={p.description}>
                          {p.description}
                        </p>
                      </div>
                      <span className="ml-2 shrink-0 text-xs text-slate-400 dark:text-slate-500">{formatCurrency(p.mrp)}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-3 text-sm text-slate-400 dark:text-slate-500">No matching part in master — this will be created as a new part.</p>
                )}
              </PortalDropdown>
            </div>
          </div>

          <div>
            <Label>Part Description *</Label>
            <Input placeholder="Front Brake Pad" value={form.partDescription} onChange={(e) => update("partDescription", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tax % *</Label>
              <Input type="number" inputMode="decimal" min={0} max={100} value={form.taxPercent} onChange={(e) => update("taxPercent", e.target.value)} />
            </div>
            <div>
              <Label>HSN Code *</Label>
              <Input placeholder="87083000" value={form.hsnCode} onChange={(e) => update("hsnCode", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>NDP (Without Tax) *</Label>
              <Input type="number" inputMode="decimal" min={0} value={form.ndp} onChange={(e) => update("ndp", e.target.value)} />
            </div>
            <div>
              <Label>Dealer Margin %</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="0"
                value={form.dealerMarginPercent}
                onChange={(e) => update("dealerMarginPercent", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                value={pricing ? formatCurrency(pricing.mrp) : ""}
                placeholder="List Price + Tax %"
                className="cursor-not-allowed bg-slate-50 text-slate-600 dark:bg-navy-800 dark:text-slate-300"
              />
            </div>
            <p className="col-span-2 -mt-2 text-[11px] text-slate-400 dark:text-slate-500">
              Calculated automatically: List Price = NDP + Dealer Margin %, then MRP = List Price + Tax %.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Quantity *</Label>
              <Input
                type="number"
                inputMode={unitAllowsDecimalQuantity(form.unit) ? "decimal" : "numeric"}
                step={unitAllowsDecimalQuantity(form.unit) ? 0.001 : 1}
                min={unitAllowsDecimalQuantity(form.unit) ? 0.001 : 1}
                value={form.quantity}
                onChange={(e) => update("quantity", e.target.value)}
              />
            </div>
            <div>
              <Label>Unit *</Label>
              <Select value={form.unit} onChange={(e) => update("unit", e.target.value)}>
                {PART_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Only ML, LTR and KGS allow decimal quantities.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label>Store *</Label>
              <Select
                value={selectedStoreId}
                onChange={(e) => {
                  setSelectedStoreId(e.target.value);
                  const store = stores?.find((s) => s.id === e.target.value);
                  update("storeCode", store?.code ?? "");
                  update("binCode", "");
                  update("rackCode", "");
                }}
              >
                <option value="">Select store</option>
                {stores?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Bin *</Label>
              <Select value={form.binCode} onChange={(e) => update("binCode", e.target.value)} disabled={!selectedStoreId}>
                <option value="">Select bin</option>
                {bins?.map((b) => (
                  <option key={b.id} value={b.code}>
                    {b.code}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Rack *</Label>
              <Select value={form.rackCode} onChange={(e) => update("rackCode", e.target.value)} disabled={!selectedStoreId}>
                <option value="">Select rack</option>
                {racks?.map((r) => (
                  <option key={r.id} value={r.code}>
                    {r.code}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {selectedStore && !bins?.length && (
            <p className="text-xs text-amber-600 dark:text-amber-400">This store has no bins yet — add one under Administration → Bins first.</p>
          )}
        </CardContent>
      </Card>

      {/* Sticky action bar on mobile so the primary action stays reachable
          without scrolling back up on a long form. Sits just above the
          global bottom tab bar (h-16) rather than underneath it. */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-white p-3 sm:static sm:z-auto sm:mt-4 sm:border-0 sm:bg-transparent sm:p-0 dark:border-navy-700 dark:bg-navy-900 sm:dark:bg-transparent">
        <div className="mx-auto flex max-w-3xl justify-end gap-2">
          <Button variant="outline" onClick={handleBack} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            isLoading={submit.isPending}
            onClick={() => {
              setError(null);
              submit.mutate();
            }}
          >
            <PackagePlus className="h-4 w-4" /> Add to Inventory
          </Button>
        </div>
      </div>

      <Dialog
        open={leaveConfirmOpen}
        onOpenChange={setLeaveConfirmOpen}
        title="Discard unsaved changes?"
        description="Are you sure you want to leave? Unsaved changes will be lost."
        footer={
          <>
            <Button variant="outline" onClick={() => setLeaveConfirmOpen(false)}>
              Stay
            </Button>
            <Button variant="danger" onClick={() => navigate(-1)}>
              Leave
            </Button>
          </>
        }
      >
        <div />
      </Dialog>
    </div>
  );
}

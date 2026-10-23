import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, PackageMinus, AlertTriangle, Hash, FileText } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { InventoryRow, PagedResult } from "@/types";
import { PageHeader } from "@/components/ui/Feedback";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Badge, stockStatusTone, stockStatusLabel } from "@/components/ui/Badge";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { unitAllowsDecimalQuantity } from "@/lib/quantity";

export function IssuePartPage() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [quantity, setQuantity] = useState<number | "">("");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { push } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const preselectId = params.get("inventoryId");

  const { data: results } = useQuery({
    queryKey: ["inventory-search", search],
    queryFn: async () =>
      (await apiClient.get<{ data: PagedResult<InventoryRow> }>("/inventory", { params: { search, pageSize: 8 } })).data.data,
    enabled: search.length > 0,
  });

  useEffect(() => {
    if (preselectId && !selected) {
      apiClient.get(`/inventory/${preselectId}`).then((res) => {
        const inv = res.data.data;
        setSelected({
          id: inv.id,
          partId: inv.partId,
          partNo: inv.part.partNo,
          description: inv.part.description,
          store: inv.store,
          bin: inv.bin,
          rack: inv.rack,
          mrp: inv.part.mrp,
          ndp: inv.part.ndp,
          taxPercent: inv.part.taxPercent,
          unit: inv.part.unit ?? "NOS",
          category: inv.part.category,
          availableQty: inv.quantity,
          minimumStockLevel: inv.part.minimumStockLevel,
          status: inv.quantity <= 0 ? "OUT_OF_STOCK" : inv.quantity <= inv.part.minimumStockLevel ? "LOW_STOCK" : "IN_STOCK",
          updatedAt: inv.updatedAt,
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectId]);

  const createIssue = useMutation({
    mutationFn: async () =>
      apiClient.post("/issues", { inventoryId: selected!.id, quantity: Number(quantity), reference: reference || undefined, remarks: remarks || undefined }),
    onSuccess: (res) => {
      push({ tone: "success", title: "Part issued", description: `Issue ${res.data.data.issueNumber} created successfully.` });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      navigate(`/issues/${res.data.data.id}`);
    },
    onError: (err) => {
      push({ tone: "error", title: "Unable to issue part", description: getApiErrorMessage(err) });
    },
    onSettled: () => setConfirmOpen(false),
  });

  const qtyNum = typeof quantity === "number" ? quantity : 0;
  const isOutOfStock = selected ? selected.availableQty <= 0 : false;
  const exceedsStock = selected ? qtyNum > selected.availableQty : false;
  const canSubmit = !!selected && qtyNum > 0 && !exceedsStock && !isOutOfStock;

  return (
    <div>
      <PageHeader title="Issue Part" subtitle="Issue a part from inventory against a job card or customer reference." breadcrumbs={["Part Issue", "Issue Part"]} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <PackageMinus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Issue Part</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Search stock and issue against a job card or reference</p>
              </div>
            </div>
            <div>
              <Label>Search Part (Part No / Description)</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <Input
                  className="pl-9"
                  placeholder="Type to search available stock..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelected(null);
                  }}
                />
              </div>
              {results && search && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 thin-scroll dark:border-navy-700">
                  {results.items.length ? (
                    results.items.map((row) => (
                      <button
                        key={row.id}
                        onClick={() => {
                          setSelected(row);
                          setSearch("");
                        }}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-navy-800"
                      >
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            {row.partNo} — {row.description}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {row.store.name ?? row.store.code} / {row.bin.code} / {row.rack.code}
                          </p>
                        </div>
                        <Badge tone={stockStatusTone(row.status)}>{row.availableQty} avail.</Badge>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-3 text-sm text-slate-400 dark:text-slate-500">No matching stock found.</p>
                  )}
                </div>
              )}
            </div>

            {selected && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-navy-700 dark:bg-navy-800/40">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {selected.partNo} — {selected.description}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selected.store.name ?? selected.store.code} / {selected.bin.code} / {selected.rack.code}
                    </p>
                    <CategoryBadge category={selected.category} className="mt-1" />
                  </div>
                  <Badge tone={stockStatusTone(selected.status)}>{stockStatusLabel(selected.status)}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Avail. Qty</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{selected.availableQty}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">MRP</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(selected.mrp)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">NDP</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(selected.ndp)}</p>
                  </div>
                </div>
              </div>
            )}

            {isOutOfStock && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" /> This part is currently out of stock.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Issue Quantity {selected && `(${selected.unit})`}</Label>
                <Input
                  type="number"
                  inputMode={selected && unitAllowsDecimalQuantity(selected.unit) ? "decimal" : "numeric"}
                  step={selected && unitAllowsDecimalQuantity(selected.unit) ? 0.001 : 1}
                  min={selected && unitAllowsDecimalQuantity(selected.unit) ? 0.001 : 1}
                  disabled={!selected || isOutOfStock}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                />
                {exceedsStock && (
                  <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    Insufficient stock. Available quantity: {selected?.availableQty}.
                  </p>
                )}
              </div>
              <div>
                <Label>Cust / Veh / JC ref</Label>
                <div className="relative">
                  <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input className="pl-9" placeholder="JC-5521 / MH12AB1234" value={reference} onChange={(e) => setReference(e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <Label>Remarks</Label>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <Textarea rows={2} className="pl-9" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-700 hover:to-blue-700"
              size="lg"
              disabled={!canSubmit}
              onClick={() => setConfirmOpen(true)}
            >
              <PackageMinus className="h-4 w-4" /> Issue Part
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">How it works</p>
            <ol className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li>1. Search and select the part &amp; location to issue from.</li>
              <li>2. Enter the quantity to issue (can't exceed available stock).</li>
              <li>3. Add a customer/job card reference for traceability.</li>
              <li>4. Confirm — inventory updates immediately and a ledger entry is created.</li>
            </ol>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm Issue"
        description={`Are you sure you want to issue ${quantity} unit(s) of ${selected?.partNo}?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createIssue.mutate()} isLoading={createIssue.isPending}>
              Confirm Issue
            </Button>
          </>
        }
      >
        <div />
      </Dialog>
    </div>
  );
}

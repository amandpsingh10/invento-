import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ClipboardEdit, FileText } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { InventoryRow, PagedResult, StockAdjustment } from "@/types";
import { PageHeader, Pagination, TableSkeleton, EmptyState } from "@/components/ui/Feedback";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/utils";
import { unitAllowsDecimalQuantity } from "@/lib/quantity";

const REASONS = [
  { value: "DAMAGE", label: "Damage" },
  { value: "THEFT", label: "Theft" },
  { value: "COUNT_CORRECTION", label: "Count Correction" },
  { value: "EXPIRY", label: "Expiry" },
  { value: "OTHER", label: "Other" },
];

export function StockAdjustmentPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [physicalQty, setPhysicalQty] = useState<number | "">("");
  const [reasonType, setReasonType] = useState("COUNT_CORRECTION");
  const [remarks, setRemarks] = useState("");
  const [page, setPage] = useState(1);
  const { push } = useToast();
  const queryClient = useQueryClient();

  const { data: results } = useQuery({
    queryKey: ["inventory-search-adj", search],
    queryFn: async () => (await apiClient.get<{ data: PagedResult<InventoryRow> }>("/inventory", { params: { search, pageSize: 8 } })).data.data,
    enabled: search.length > 0,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["adjustments", page],
    queryFn: async () => (await apiClient.get<{ data: PagedResult<StockAdjustment> }>("/adjustments", { params: { page, pageSize: 10 } })).data.data,
  });

  const createAdjustment = useMutation({
    mutationFn: async () =>
      apiClient.post("/adjustments", {
        inventoryId: selected!.id,
        physicalQuantity: Number(physicalQty),
        reasonType,
        remarks: remarks || undefined,
      }),
    onSuccess: (res) => {
      push({ tone: "success", title: "Adjustment recorded", description: `${res.data.data.adjustmentNumber} created successfully.` });
      queryClient.invalidateQueries({ queryKey: ["adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setSelected(null);
      setPhysicalQty("");
      setRemarks("");
    },
    onError: (err) => push({ tone: "error", title: "Unable to adjust stock", description: getApiErrorMessage(err) }),
  });

  const difference = selected && physicalQty !== "" ? Number(physicalQty) - selected.availableQty : null;

  return (
    <div>
      <PageHeader title="Stock Adjustment" subtitle="Correct system stock to match a physical count." breadcrumbs={["Inventory", "Stock Adjustment"]} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <ClipboardEdit className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Stock Adjustment</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Correct system stock to match a physical count</p>
              </div>
            </div>
            <div>
              <Label>Search Part &amp; Location</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <Input className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setSelected(null); }} placeholder="Search inventory..." />
              </div>
              {results && search && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-navy-700 thin-scroll">
                  {results.items.map((row) => (
                    <button
                      key={row.id}
                      onClick={() => { setSelected(row); setSearch(""); }}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-navy-800"
                    >
                      <span>
                        {row.partNo} — {row.description} <span className="text-xs text-slate-400 dark:text-slate-500">({row.store.name ?? row.store.code}/{row.bin.code}/{row.rack.code})</span>
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Sys: {row.availableQty}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selected && (
              <>
                <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 dark:bg-navy-800 p-4">
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Part</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{selected.description}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{selected.partNo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">System Quantity</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{selected.availableQty}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Physical Quantity ({selected.unit})</Label>
                    <Input
                      type="number"
                      inputMode={unitAllowsDecimalQuantity(selected.unit) ? "decimal" : "numeric"}
                      step={unitAllowsDecimalQuantity(selected.unit) ? 0.001 : 1}
                      min={0}
                      value={physicalQty}
                      onChange={(e) => setPhysicalQty(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Adjustment Reason</Label>
                    <Select value={reasonType} onChange={(e) => setReasonType(e.target.value)}>
                      {REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {difference !== null && (
                  <div className="rounded-lg border border-slate-200 dark:border-navy-700 px-4 py-3 text-sm">
                    Difference:{" "}
                    <span className={`font-semibold ${difference < 0 ? "text-red-600 dark:text-red-400" : difference > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300"}`}>
                      {difference > 0 ? "+" : ""}
                      {difference}
                    </span>
                  </div>
                )}

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
                  disabled={physicalQty === "" || createAdjustment.isPending}
                  isLoading={createAdjustment.isPending}
                  onClick={() => createAdjustment.mutate()}
                >
                  <ClipboardEdit className="h-4 w-4" /> Save Adjustment
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Recent Adjustments</p>
            {historyLoading ? (
              <TableSkeleton cols={3} rows={4} />
            ) : history?.items.length ? (
              <div className="space-y-3">
                {history.items.map((adj) => (
                  <div
                    key={adj.id}
                    className={`overflow-hidden rounded-2xl border-l-4 bg-white p-3 text-sm shadow-card dark:bg-navy-900 ${
                      adj.difference < 0 ? "border-l-red-500" : "border-l-emerald-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{adj.adjustmentNumber}</p>
                      <Badge tone={adj.difference < 0 ? "danger" : "success"}>{adj.difference > 0 ? "+" : ""}{adj.difference}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{adj.part.partNo}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{formatDateTime(adj.createdAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No adjustments yet" />
            )}
            {history && history.total > 0 && (
              <div className="mt-2">
                <Pagination page={page} totalPages={history.totalPages} total={history.total} pageSize={10} onPageChange={setPage} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

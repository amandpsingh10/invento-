import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Undo2, AlertTriangle, Ban, FileText, Info, Boxes, CheckCircle2, X } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { ReturnableSource, ReturnableItem, ReturnableSearchResult } from "@/types";
import { PageHeader } from "@/components/ui/Feedback";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { useToast } from "@/components/ui/Toast";
import { formatDate, cn } from "@/lib/utils";
import { unitAllowsDecimalQuantity } from "@/lib/quantity";

const HOW_IT_WORKS = [
  "Search by Invoice No, Issue No, or the customer's mobile number.",
  "If it's a completed sale, cancel the invoice first — required before any return.",
  "Select one or more parts and enter each return quantity, capped at what's still returnable.",
  "Confirm — inventory increases and a ledger entry is created.",
];

/** Invoice lookups repurpose `reference` to carry "Customer Name — Mobile" (see returns.service.ts); split it back out for display. Issue lookups keep a plain job-card reference, which just won't contain the separator. */
function splitSourceReference(reference: string | null): [string | null, string | null] {
  if (!reference) return [null, null];
  const parts = reference.split(" — ");
  return parts.length === 2 ? [parts[0], parts[1]] : [reference, null];
}

export function ReturnPartPage() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("issueNumber") ?? params.get("invoiceNumber") ?? "");
  const [searchResults, setSearchResults] = useState<ReturnableSearchResult[]>([]);
  const [source, setSource] = useState<ReturnableSource | null>(null);
  // Item id -> return quantity. A Map (not a single selectedItem) is what
  // makes multi-select possible — the user can tick several returnable
  // parts from the same invoice/issue and submit them together.
  const [selectedQty, setSelectedQty] = useState<Map<string, number | "">>(new Map());
  const [remarks, setRemarks] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const { push } = useToast();
  const queryClient = useQueryClient();

  async function loadSource(kind: "ISSUE" | "INVOICE", number: string) {
    setLoadingLookup(true);
    setLookupError(null);
    setSource(null);
    setSelectedQty(new Map());
    setSearchResults([]);
    try {
      const path = kind === "ISSUE" ? `/returns/lookup/${encodeURIComponent(number)}` : `/returns/lookup-invoice/${encodeURIComponent(number)}`;
      const res = await apiClient.get<{ data: ReturnableSource }>(path);
      setSource(res.data.data);
      if (res.data.data.items.length === 1 && !res.data.data.requiresCancellationFirst && res.data.data.items[0].remainingReturnableQty > 0) {
        setSelectedQty(new Map([[res.data.data.items[0].id, ""]]));
      }
    } catch (err) {
      setLookupError(getApiErrorMessage(err, `"${number}" not found`));
    } finally {
      setLoadingLookup(false);
    }
  }

  async function runSearch(q: string) {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await apiClient.get<{ data: ReturnableSearchResult[] }>("/returns/search", { params: { q } });
      setSearchResults(res.data.data);
    } catch {
      setSearchResults([]);
    }
  }

  useEffect(() => {
    const issueNumber = params.get("issueNumber");
    const invoiceNumber = params.get("invoiceNumber");
    if (issueNumber) loadSource("ISSUE", issueNumber);
    else if (invoiceNumber) loadSource("INVOICE", invoiceNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelInvoice = useMutation({
    mutationFn: async () => apiClient.post(`/invoices/${source!.id}/cancel`, { reason: cancelReason }),
    onSuccess: async () => {
      push({ tone: "success", title: "Invoice cancelled", description: `Invoice ${source!.number} cancelled successfully.` });
      setCancelOpen(false);
      setCancelReason("");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await loadSource("INVOICE", source!.number);
    },
    onError: (err) => push({ tone: "error", title: "Unable to cancel invoice", description: getApiErrorMessage(err) }),
  });

  function handleConfirmCancelInvoice() {
    if (!cancelReason.trim()) {
      setCancelReasonError("A cancellation reason is required");
      return;
    }
    setCancelReasonError(null);
    cancelInvoice.mutate();
  }

  const selectedItems = source ? source.items.filter((item) => selectedQty.has(item.id)) : [];
  const hasInvalidSelection = selectedItems.some((item) => {
    const q = selectedQty.get(item.id);
    return q === "" || q === undefined || Number(q) <= 0 || Number(q) > item.remainingReturnableQty;
  });
  const canSubmit = selectedItems.length > 0 && !hasInvalidSelection;

  function toggleSelect(item: ReturnableItem) {
    setSelectedQty((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, "");
      return next;
    });
  }

  function setItemQty(itemId: string, qty: number | "") {
    setSelectedQty((prev) => new Map(prev).set(itemId, qty));
  }

  // Each selected item still goes through the existing single-item /returns
  // endpoint — the backend already models one Return as tracing back to one
  // source item, so this keeps that per-item audit trail rather than
  // widening the API contract. Sequential (not Promise.all) so concurrent
  // transactions don't pile up against the same invoice/issue in Postgres.
  const createReturn = useMutation({
    mutationFn: async () => {
      let succeeded = 0;
      const failures: string[] = [];
      for (const item of selectedItems) {
        const qty = selectedQty.get(item.id);
        try {
          await apiClient.post("/returns", {
            ...(item.kind === "ISSUE_ITEM" ? { issueItemId: item.id } : { invoiceItemId: item.id }),
            quantity: Number(qty),
            remarks: remarks || undefined,
          });
          succeeded++;
        } catch (err) {
          failures.push(`${item.partNo}: ${getApiErrorMessage(err)}`);
        }
      }
      return { succeeded, failures };
    },
    onSuccess: async ({ succeeded, failures }) => {
      if (succeeded > 0) {
        push({ tone: "success", title: `${succeeded} part${succeeded === 1 ? "" : "s"} returned`, description: "Inventory updated." });
      }
      if (failures.length > 0) {
        push({ tone: "error", title: `${failures.length} return${failures.length === 1 ? "" : "s"} failed`, description: failures.join("; ") });
      }
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setSelectedQty(new Map());
      if (failures.length === 0) {
        setRemarks("");
        setQuery("");
        setSource(null);
      } else if (source) {
        await loadSource(source.kind, source.number);
      }
    },
    onError: (err) => push({ tone: "error", title: "Unable to return parts", description: getApiErrorMessage(err) }),
    onSettled: () => setConfirmOpen(false),
  });

  const [refName, refMobile] = splitSourceReference(source?.reference ?? null);

  return (
    <div>
      <PageHeader title="Return Part" subtitle="Return previously issued or sold parts back to inventory." breadcrumbs={["Part Return", "Return Part"]} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 p-5">
            <div>
              <Label>Search by Invoice No / Issue No / Customer Mobile</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input
                    className="pl-9"
                    placeholder="INV-2026-000001, ISS-2026-000001, or 98765..."
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      runSearch(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && query) {
                        loadSource(query.toUpperCase().startsWith("ISS") ? "ISSUE" : "INVOICE", query);
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={() => query && loadSource(query.toUpperCase().startsWith("ISS") ? "ISSUE" : "INVOICE", query)}
                  disabled={!query || loadingLookup}
                >
                  <Search className="h-4 w-4" /> Search
                </Button>
              </div>
              {loadingLookup && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Looking up…</p>}
              {lookupError && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{lookupError}</p>}
              {searchResults.length > 0 && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 thin-scroll dark:border-navy-700">
                  {searchResults.map((r) => (
                    <button
                      key={`${r.kind}-${r.number}`}
                      onClick={() => {
                        setQuery(r.number);
                        loadSource(r.kind, r.number);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-navy-800"
                    >
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-200">{r.number}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {r.kind === "INVOICE" ? "Sale" : "Issue"} &middot; {r.label} &middot; {formatDate(r.date)}
                        </p>
                      </div>
                      <Badge tone={r.status === "CANCELLED" ? "danger" : "info"}>{r.status}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {source && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-navy-700">
                <div className="flex items-start gap-3 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{source.number}</p>
                      <Badge tone={source.status === "CANCELLED" ? "danger" : source.status.includes("RETURN") ? "success" : "info"} className="shrink-0">
                        {source.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p
                      className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400"
                      title={[formatDate(source.date), refName, refMobile].filter(Boolean).join(" · ")}
                    >
                      {formatDate(source.date)}
                      {refName && <> &middot; {refName}</>}
                      {refMobile && <> &middot; {refMobile}</>}
                    </p>
                  </div>
                </div>

                {source.requiresCancellationFirst && (
                  <div className="mx-4 mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>Invoice must be cancelled before returning the part.</p>
                    </div>
                    <Button variant="danger" size="sm" className="mt-2" onClick={() => setCancelOpen(true)}>
                      <Ban className="h-4 w-4" /> Cancel Invoice
                    </Button>
                  </div>
                )}

                <div className="border-t border-slate-100 p-4 dark:border-navy-800">
                  <div className="mb-3 flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Parts in this Invoice</p>
                  </div>

                  {/* Desktop table */}
                  <div className="hidden overflow-hidden rounded-lg border border-slate-100 md:block dark:border-navy-800">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-navy-800/40 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-2.5" />
                          <th className="px-4 py-2.5">Part No</th>
                          <th className="px-4 py-2.5">Description</th>
                          <th className="px-4 py-2.5 text-right">Sold/Issued</th>
                          <th className="px-4 py-2.5 text-right">Returned</th>
                          <th className="px-4 py-2.5 text-right">Remaining</th>
                          <th className="px-4 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                        {source.items.map((item) => {
                          const fullyReturned = item.remainingReturnableQty <= 0;
                          const selected = selectedQty.has(item.id);
                          return (
                            <tr
                              key={item.id}
                              onClick={() => !fullyReturned && toggleSelect(item)}
                              className={cn(
                                "cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800",
                                fullyReturned && "cursor-not-allowed opacity-50 hover:bg-transparent",
                                selected && "bg-brand-50 hover:bg-brand-50 dark:bg-brand-500/15 dark:hover:bg-brand-500/15"
                              )}
                            >
                              <td className="px-4 py-2.5">
                                <span
                                  className={cn(
                                    "flex h-5 w-5 items-center justify-center rounded-full border",
                                    selected ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 dark:border-navy-600"
                                  )}
                                >
                                  {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{item.partNo}</td>
                              <td className="px-4 py-2.5">
                                {item.description}
                                <CategoryBadge category={item.category} className="ml-2" />
                              </td>
                              <td className="px-4 py-2.5 text-right">{item.originalQty}</td>
                              <td className="px-4 py-2.5 text-right">{item.alreadyReturnedQty}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-slate-800 dark:text-slate-200">{item.remainingReturnableQty}</td>
                              <td className="px-4 py-2.5">
                                <Badge tone={fullyReturned ? "success" : "info"}>{fullyReturned ? "Fully Returned" : "Returnable"}</Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="space-y-2.5 md:hidden">
                    {source.items.map((item) => {
                      const fullyReturned = item.remainingReturnableQty <= 0;
                      const selected = selectedQty.has(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => !fullyReturned && toggleSelect(item)}
                          disabled={fullyReturned}
                          className={cn(
                            "w-full rounded-xl border border-slate-200 p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 dark:border-navy-700",
                            selected && "border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/15"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-start gap-2">
                              <span
                                className={cn(
                                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                                  selected ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 dark:border-navy-600"
                                )}
                              >
                                {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={item.partNo}>
                                  {item.partNo}
                                </p>
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={item.description}>
                                  {item.description}
                                </p>
                                <CategoryBadge category={item.category} className="mt-1" />
                              </div>
                            </div>
                            <Badge tone={fullyReturned ? "success" : "info"} className="shrink-0">
                              {fullyReturned ? "Fully Returned" : "Returnable"}
                            </Badge>
                          </div>
                          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-xs">
                            <div>
                              <p className="text-slate-400 dark:text-slate-500">Sold/Issued</p>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{item.originalQty}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 dark:text-slate-500">Returned</p>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{item.alreadyReturnedQty}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 dark:text-slate-500">Remaining</p>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{item.remainingReturnableQty}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {selectedItems.length > 0 && (
              <>
                <div className="space-y-2.5">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Selected Parts ({selectedItems.length})
                  </p>
                  {selectedItems.map((item) => {
                    const qty = selectedQty.get(item.id) ?? "";
                    const exceedsRemaining = qty !== "" && Number(qty) > item.remainingReturnableQty;
                    return (
                      <div key={item.id} className="rounded-xl border border-slate-200 p-3 dark:border-navy-700">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200" title={item.partNo}>
                              {item.partNo}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={item.description}>
                              {item.description} &middot; Remaining: <span className="font-semibold text-brand-600 dark:text-brand-400">{item.remainingReturnableQty}</span>
                            </p>
                          </div>
                          <button
                            onClick={() => toggleSelect(item)}
                            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-2">
                          <Label className="text-xs">Return Quantity ({item.unit})</Label>
                          <Input
                            type="number"
                            inputMode={unitAllowsDecimalQuantity(item.unit) ? "decimal" : "numeric"}
                            step={unitAllowsDecimalQuantity(item.unit) ? 0.001 : 1}
                            min={unitAllowsDecimalQuantity(item.unit) ? 0.001 : 1}
                            placeholder="Enter quantity"
                            value={qty}
                            className={exceedsRemaining ? "border-red-400 dark:border-red-500/60" : ""}
                            onChange={(e) => setItemQty(item.id, e.target.value === "" ? "" : Number(e.target.value))}
                          />
                          {exceedsRemaining && (
                            <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">Cannot exceed {item.remainingReturnableQty}.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <Label>Remarks (applies to all selected parts)</Label>
                  <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </div>

                <div className="flex justify-end">
                  <Button disabled={!canSubmit} onClick={() => setConfirmOpen(true)}>
                    <Undo2 className="h-4 w-4" /> Return {selectedItems.length > 1 ? `${selectedItems.length} Parts` : "Part"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-brand-500 dark:text-brand-400" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">How it works</p>
              </div>
              <ol className="space-y-3">
                {HOW_IT_WORKS.map((text, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-500 dark:text-slate-400">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                      {i + 1}
                    </span>
                    {text}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-500/30 dark:bg-blue-500/10">
            <CardContent className="flex items-start gap-2.5 p-4">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />
              <p className="text-xs text-blue-800 dark:text-blue-400">
                Only parts with remaining quantity can be returned. Fully returned items cannot be selected.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm Return"
        description={
          selectedItems.length === 1
            ? `Are you sure you want to return ${selectedQty.get(selectedItems[0].id)} unit(s) of ${selectedItems[0].partNo}?`
            : `Are you sure you want to return ${selectedItems.length} parts (${selectedItems.map((i) => i.partNo).join(", ")})?`
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createReturn.mutate()} isLoading={createReturn.isPending}>
              Confirm Return
            </Button>
          </>
        }
      >
        <div />
      </Dialog>

      <Dialog
        open={cancelOpen}
        onOpenChange={(o) => {
          setCancelOpen(o);
          if (!o) {
            setCancelReason("");
            setCancelReasonError(null);
          }
        }}
        title="Cancel Invoice"
        description={`Are you sure you want to cancel Invoice ${source?.number}? Invoice cancellation is required before returning sold parts.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmCancelInvoice} isLoading={cancelInvoice.isPending}>
              Confirm Cancellation
            </Button>
          </>
        }
      >
        <div>
          <Label>Reason *</Label>
          <Textarea
            rows={2}
            value={cancelReason}
            onChange={(e) => {
              setCancelReason(e.target.value);
              if (cancelReasonError) setCancelReasonError(null);
            }}
          />
          {cancelReasonError && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{cancelReasonError}</p>}
        </div>
      </Dialog>
    </div>
  );
}

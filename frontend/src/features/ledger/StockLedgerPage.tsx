import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Search, Filter, Tag, Calendar, FileText, Box, MapPin, Layers, User, ArrowUpCircle, ArrowDownCircle, ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import type { PagedResult, StockLedgerEntry } from "@/types";
import { PageHeader, Pagination } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { IconFieldRow } from "@/components/ui/IconFieldRow";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/utils";
import { PART_CATEGORIES, PART_CATEGORY_LABELS } from "@/lib/partCategory";
import { txnTypeTone } from "./txnTypeTone";
import { saveFileToDevice } from "@/lib/nativeFile";

function LedgerMobileCard({ entry }: { entry: StockLedgerEntry }) {
  const isPositive = entry.quantityChange >= 0;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200">{entry.transactionNumber}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(entry.createdAt)}</p>
        </div>
        <div className="flex items-center gap-1">
          <Badge tone={txnTypeTone(entry.transactionType)}>{entry.transactionType}</Badge>
          <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        <IconFieldRow icon={FileText} label="Invoice No" value={entry.invoiceNumber ?? "—"} />
        <IconFieldRow icon={Box} label="Part No" value={entry.part?.partNo ?? "—"} />
        <IconFieldRow icon={Tag} label="Category" value={entry.part ? <CategoryBadge category={entry.part.category} /> : "—"} />
        <IconFieldRow
          icon={MapPin}
          label="Location"
          value={entry.inventory ? `${entry.inventory.store.name ?? entry.inventory.store.code} / ${entry.inventory.bin.code} / ${entry.inventory.rack.code}` : "—"}
        />
        <IconFieldRow
          icon={isPositive ? ArrowUpCircle : ArrowDownCircle}
          iconClassName={isPositive ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}
          label="Qty Change"
          emphasize
          value={
            <span className={isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
              {isPositive ? "+" : ""}
              {entry.quantityChange} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{entry.part?.unit}</span>
            </span>
          }
        />
        <IconFieldRow icon={Layers} label="Balance" value={entry.balanceQuantity} />
        <IconFieldRow icon={User} label="Created By" value={entry.createdByName} />
      </div>
    </div>
  );
}

export function StockLedgerPage() {
  const [search, setSearch] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { push } = useToast();

  const params = {
    search: search || undefined,
    transactionType: transactionType || undefined,
    category: category || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["stock-ledger", params],
    queryFn: async () => (await apiClient.get<{ data: PagedResult<StockLedgerEntry> }>("/stock-ledger", { params })).data.data,
  });

  async function exportExcel() {
    const res = await apiClient.get("/reports/transactions", { params: { ...params, export: "excel", pageSize: 5000 }, responseType: "blob" });
    const file = new File([res.data], "Transaction-Report.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const result = await saveFileToDevice(file);
    if (result === "shared") {
      push({ tone: "success", title: "Choose where to save", description: 'Pick "Save to Files" or "Drive" from the menu that opened.' });
    } else if (result === "downloaded") {
      push({ tone: "success", title: "Excel file downloaded" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Stock Ledger"
        subtitle="The immutable source of truth for every stock movement."
        breadcrumbs={["Inventory", "Stock Ledger"]}
        actions={
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download className="h-4 w-4" /> Export Excel
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-navy-800 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Search Part No, Invoice, Txn No..."
              className="rounded-full pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Select
              value={transactionType}
              onChange={(e) => {
                setTransactionType(e.target.value);
                setPage(1);
              }}
              className="w-40 rounded-full pl-9"
            >
              <option value="">All Types</option>
              <option value="PURCHASE">Purchase</option>
              <option value="ISSUE">Issue</option>
              <option value="RETURN">Return</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </Select>
          </div>
          <div className="relative">
            <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-44 rounded-full pl-9"
            >
              <option value="">All Categories</option>
              {PART_CATEGORIES.map((code) => (
                <option key={code} value={code}>
                  {code} — {PART_CATEGORY_LABELS[code]}
                </option>
              ))}
            </Select>
          </div>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              type="date"
              className="w-40 rounded-full pl-9"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              type="date"
              className="w-40 rounded-full pl-9"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <DataTable<StockLedgerEntry>
          isLoading={isLoading}
          items={data?.items ?? []}
          rowKey={(e) => e.id}
          emptyTitle="No ledger entries found"
          emptyDescription="Try adjusting your filters or date range."
          renderMobileCard={(entry) => <LedgerMobileCard entry={entry} />}
          columns={
            [
              { header: "Transaction No", render: (e) => <span className="font-medium text-slate-800 dark:text-slate-200">{e.transactionNumber}</span> },
              { header: "Date", render: (e) => formatDateTime(e.createdAt) },
              { header: "Type", render: (e) => <Badge tone={txnTypeTone(e.transactionType)}>{e.transactionType}</Badge> },
              { header: "Invoice No", render: (e) => e.invoiceNumber ?? "—" },
              { header: "Part No", render: (e) => e.part?.partNo },
              { header: "Category", render: (e) => (e.part ? <CategoryBadge category={e.part.category} /> : "—") },
              {
                header: "Location",
                render: (e) => (e.inventory ? `${e.inventory.store.name ?? e.inventory.store.code} / ${e.inventory.bin.code} / ${e.inventory.rack.code}` : "—"),
              },
              {
                header: "Qty Change",
                align: "right",
                render: (e) => (
                  <span className={`font-semibold ${e.quantityChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {e.quantityChange >= 0 ? "+" : ""}
                    {e.quantityChange} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{e.part?.unit}</span>
                  </span>
                ),
              },
              { header: "Balance", align: "right", render: (e) => e.balanceQuantity },
              { header: "Created By", render: (e) => e.createdByName },
            ] satisfies DataColumn<StockLedgerEntry>[]
          }
        />
        {data && data.total > 0 && (
          <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}

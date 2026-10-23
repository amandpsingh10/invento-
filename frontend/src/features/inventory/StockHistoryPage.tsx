import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { PagedResult, StockLedgerEntry } from "@/types";
import { PageHeader } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { formatDateTime } from "@/lib/utils";
import { txnTypeTone } from "@/features/ledger/txnTypeTone";

export function StockHistoryPage() {
  const { id } = useParams<{ id: string }>();

  const { data: inv } = useQuery({
    queryKey: ["inventory", id],
    queryFn: async () => (await apiClient.get(`/inventory/${id}`)).data.data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["inventory-history", id],
    queryFn: async () => (await apiClient.get<{ data: PagedResult<StockLedgerEntry> }>(`/inventory/${id}/history`)).data.data,
  });

  return (
    <div>
      <PageHeader
        title="Stock History"
        subtitle={inv ? `${inv.part.partNo} — ${inv.store.name} / ${inv.bin.code} / ${inv.rack.code}` : "Loading..."}
        breadcrumbs={["Inventory", "Current Stock", "History"]}
        actions={inv?.part?.category && <CategoryBadge category={inv.part.category} />}
      />
      <Card>
        <DataTable<StockLedgerEntry>
          isLoading={isLoading}
          items={data?.items ?? []}
          rowKey={(e) => e.id}
          emptyTitle="No movement recorded yet"
          columns={
            [
              { header: "Transaction No", render: (e) => <span className="font-medium text-slate-800 dark:text-slate-200">{e.transactionNumber}</span> },
              { header: "Date", render: (e) => formatDateTime(e.createdAt) },
              { header: "Type", render: (e) => <Badge tone={txnTypeTone(e.transactionType)}>{e.transactionType}</Badge> },
              { header: "Reference", render: (e) => e.reference ?? e.invoiceNumber ?? "—" },
              {
                header: "Qty Change",
                align: "right",
                render: (e) => (
                  <span className={`font-semibold ${e.quantityChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {e.quantityChange >= 0 ? "+" : ""}
                    {e.quantityChange} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{inv?.part?.unit}</span>
                  </span>
                ),
              },
              { header: "Balance", align: "right", render: (e) => e.balanceQuantity },
              { header: "Created By", render: (e) => e.createdByName },
            ] satisfies DataColumn<StockLedgerEntry>[]
          }
        />
      </Card>
    </div>
  );
}

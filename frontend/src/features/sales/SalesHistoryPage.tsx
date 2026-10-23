import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Eye, Undo2 } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import type { Invoice, PagedResult } from "@/types";
import { PageHeader, Pagination } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_TONE: Record<string, any> = { DRAFT: "neutral", COMPLETED: "success", CANCELLED: "danger" };

export function SalesHistoryPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", { search, status, page }],
    queryFn: async () =>
      (await apiClient.get<{ data: PagedResult<Invoice> }>("/invoices", { params: { search: search || undefined, status: status || undefined, page, pageSize } })).data
        .data,
  });

  return (
    <div>
      <PageHeader title="Sales History" subtitle="All customer sales and invoices." breadcrumbs={["Part Sell", "Sales History"]} />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-navy-800 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input placeholder="Search Invoice No, Customer, Mobile..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-44">
            <option value="">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>

        <DataTable<Invoice>
          isLoading={isLoading}
          items={data?.items ?? []}
          rowKey={(inv) => inv.id}
          emptyTitle="No sales yet"
          columns={
            [
              { header: "Invoice No", render: (inv) => <span className="font-medium text-slate-800 dark:text-slate-200">{inv.invoiceNumber}</span> },
              { header: "Date", render: (inv) => formatDate(inv.invoiceDate) },
              { header: "Customer", render: (inv) => `${inv.customer.name} (${inv.customer.mobile})` },
              { header: "Parts", render: (inv) => inv.items.map((i) => `${i.part.partNo} (${i.quantity})`).join(", ") },
              { header: "Grand Total", align: "right", render: (inv) => formatCurrency(inv.grandTotal) },
              { header: "Status", render: (inv) => <Badge tone={STATUS_TONE[inv.status] ?? "neutral"}>{inv.status}</Badge> },
              {
                header: "Actions",
                align: "right",
                render: (inv) => (
                  <div className="flex justify-end gap-1">
                    <Link to={`/invoices/${inv.id}`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-navy-800 dark:hover:text-slate-300" title="View">
                      <Eye className="h-4 w-4" />
                    </Link>
                    {inv.status !== "CANCELLED" && (
                      <Link
                        to={`/returns/new?invoiceNumber=${inv.invoiceNumber}`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-purple-50 hover:text-purple-600 dark:text-slate-500 dark:hover:bg-purple-500/10 dark:hover:text-purple-400"
                        title="Return"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                ),
              },
            ] satisfies DataColumn<Invoice>[]
          }
        />
        {data && data.total > 0 && (
          <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}

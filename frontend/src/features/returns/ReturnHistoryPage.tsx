import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Undo2, FileText, PackageMinus, Box, User, ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import type { PagedResult, ReturnRecord } from "@/types";
import { PageHeader, Pagination } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { IconFieldRow } from "@/components/ui/IconFieldRow";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { formatDate } from "@/lib/utils";

function partsSummary(ret: ReturnRecord) {
  return ret.items.map((i) => `${i.part.partNo} [${i.part.category}] (${i.quantity} ${i.part.unit})`).join(", ");
}

function ReturnMobileCard({ ret }: { ret: ReturnRecord }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
            <Undo2 className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200">{ret.returnNumber}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{formatDate(ret.returnDate)}</p>
          </div>
        </div>
        <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
      </div>

      <div className="mt-3 space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          {ret.issue?.issueNumber && <IconFieldRow icon={PackageMinus} label="Issue No" value={ret.issue.issueNumber} />}
          {ret.invoice?.invoiceNumber && <IconFieldRow icon={FileText} label="Invoice No" value={ret.invoice.invoiceNumber} />}
          <IconFieldRow icon={User} label="Returned By" value={`${ret.createdBy?.firstName ?? ""} ${ret.createdBy?.lastName ?? ""}`.trim() || "—"} />
        </div>
        <IconFieldRow icon={Box} label="Parts" value={partsSummary(ret)} />
      </div>
    </div>
  );
}

export function ReturnHistoryPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["returns", { search, page }],
    queryFn: async () =>
      (await apiClient.get<{ data: PagedResult<ReturnRecord> }>("/returns", { params: { search: search || undefined, page, pageSize } })).data.data,
  });

  return (
    <div>
      <PageHeader title="Return History" subtitle="All parts returned to inventory." breadcrumbs={["Part Return", "Return History"]} />

      <Card>
        <div className="border-b border-slate-100 p-4 dark:border-navy-800">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Search Return No..."
              className="rounded-full pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <DataTable<ReturnRecord>
          isLoading={isLoading}
          items={data?.items ?? []}
          rowKey={(ret) => ret.id}
          emptyTitle="No returns recorded yet"
          renderMobileCard={(ret) => <ReturnMobileCard ret={ret} />}
          columns={
            [
              { header: "Return No", render: (ret) => <span className="font-medium text-slate-800 dark:text-slate-200">{ret.returnNumber}</span> },
              { header: "Date", render: (ret) => formatDate(ret.returnDate) },
              { header: "Issue No", render: (ret) => ret.issue?.issueNumber },
              { header: "Parts", render: (ret) => partsSummary(ret) },
              { header: "Returned By", render: (ret) => `${ret.createdBy?.firstName ?? ""} ${ret.createdBy?.lastName ?? ""}`.trim() },
            ] satisfies DataColumn<ReturnRecord>[]
          }
        />
        {data && data.total > 0 && (
          <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}

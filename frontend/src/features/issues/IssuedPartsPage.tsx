import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Eye, Undo2, Filter, Box, Hash } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import type { Issue, PagedResult } from "@/types";
import { PageHeader, Pagination } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { IconFieldRow } from "@/components/ui/IconFieldRow";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { formatDate } from "@/lib/utils";

const STATUS_TONE: Record<string, any> = {
  ISSUED: "info",
  PARTIALLY_RETURNED: "warning",
  FULLY_RETURNED: "success",
  CANCELLED: "danger",
};

function partsSummary(issue: Issue) {
  return issue.items.map((i) => `${i.part.partNo} [${i.part.category}] (${i.quantity} ${i.part.unit})`).join(", ");
}

function IssueMobileCard({ issue }: { issue: Issue }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-navy-700 dark:bg-navy-900">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200">{issue.issueNumber}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{formatDate(issue.issueDate)}</p>
          </div>
          <Badge tone={STATUS_TONE[issue.status] ?? "neutral"} className="shrink-0">
            {issue.status.replace("_", " ")}
          </Badge>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
          <IconFieldRow icon={Hash} label="Reference" value={issue.reference ?? "—"} />
          <IconFieldRow icon={Box} label="Parts" value={partsSummary(issue)} />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 dark:border-navy-800">
        <Link
          to={`/issues/${issue.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-100 py-2 text-sm font-semibold text-slate-600 active:scale-[0.98] dark:bg-navy-800 dark:text-slate-300"
        >
          <Eye className="h-4 w-4" /> View
        </Link>
        {issue.status !== "FULLY_RETURNED" && (
          <Link
            to={`/returns/new?issueNumber=${issue.issueNumber}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-purple-50 py-2 text-sm font-semibold text-purple-600 active:scale-[0.98] dark:bg-purple-500/10 dark:text-purple-400"
          >
            <Undo2 className="h-4 w-4" /> Return
          </Link>
        )}
      </div>
    </div>
  );
}

export function IssuedPartsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["issues", { search, status, page }],
    queryFn: async () =>
      (await apiClient.get<{ data: PagedResult<Issue> }>("/issues", { params: { search: search || undefined, status: status || undefined, page, pageSize } })).data
        .data,
  });

  return (
    <div>
      <PageHeader title="Issued Parts" subtitle="All parts issued from inventory." breadcrumbs={["Part Issue", "Issued Parts"]} />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-navy-800">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Search Issue No or Reference..."
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
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-52 rounded-full pl-9"
            >
              <option value="">All Status</option>
              <option value="ISSUED">Issued</option>
              <option value="PARTIALLY_RETURNED">Partially Returned</option>
              <option value="FULLY_RETURNED">Fully Returned</option>
            </Select>
          </div>
        </div>

        <DataTable<Issue>
          isLoading={isLoading}
          items={data?.items ?? []}
          rowKey={(issue) => issue.id}
          emptyTitle="No issues found"
          renderMobileCard={(issue) => <IssueMobileCard issue={issue} />}
          columns={
            [
              { header: "Issue No", render: (issue) => <span className="font-medium text-slate-800 dark:text-slate-200">{issue.issueNumber}</span> },
              { header: "Date", render: (issue) => formatDate(issue.issueDate) },
              { header: "Parts", render: (issue) => partsSummary(issue) },
              { header: "Reference", render: (issue) => issue.reference ?? "—" },
              { header: "Status", render: (issue) => <Badge tone={STATUS_TONE[issue.status] ?? "neutral"}>{issue.status.replace("_", " ")}</Badge> },
              {
                header: "Actions",
                align: "right",
                render: (issue) => (
                  <div className="flex justify-end gap-1">
                    <Link to={`/issues/${issue.id}`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-navy-800 dark:hover:text-slate-300" title="View">
                      <Eye className="h-4 w-4" />
                    </Link>
                    {issue.status !== "FULLY_RETURNED" && (
                      <Link
                        to={`/returns/new?issueNumber=${issue.issueNumber}`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-purple-50 hover:text-purple-600 dark:text-slate-500 dark:hover:bg-purple-500/10 dark:hover:text-purple-400"
                        title="Return"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                ),
              },
            ] satisfies DataColumn<Issue>[]
          }
        />
        {data && data.total > 0 && (
          <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}

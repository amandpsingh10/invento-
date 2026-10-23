import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer, Undo2 } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import type { Issue, IssueItem } from "@/types";
import { PageHeader, Skeleton } from "@/components/ui/Feedback";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { formatDate, formatCurrency } from "@/lib/utils";

export function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: issue, isLoading } = useQuery({
    queryKey: ["issue", id],
    queryFn: async () => (await apiClient.get<{ data: Issue }>(`/issues/${id}`)).data.data,
  });

  if (isLoading || !issue) {
    return (
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Issue ${issue.issueNumber}`}
        subtitle={formatDate(issue.issueDate)}
        breadcrumbs={["Part Issue", "Issued Parts", issue.issueNumber]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(`/issues/${issue.id}/print`)}>
              <Printer className="h-4 w-4" /> Print Issue Slip
            </Button>
            {issue.status !== "FULLY_RETURNED" && (
              <Link to={`/returns/new?issueNumber=${issue.issueNumber}`}>
                <Button size="sm">
                  <Undo2 className="h-4 w-4" /> Return
                </Button>
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <DataTable<IssueItem>
              items={issue.items}
              rowKey={(item) => item.id}
              emptyTitle="No items on this issue"
              columns={
                [
                  {
                    header: "Part",
                    render: (item) => (
                      <>
                        <p className="font-medium text-slate-800 dark:text-slate-200">{item.part.description}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.part.partNo}</p>
                        <CategoryBadge category={item.part.category} className="mt-1" />
                      </>
                    ),
                  },
                  {
                    header: "Location",
                    render: (item) => `${item.inventory.store.name} / ${item.inventory.bin.code} / ${item.inventory.rack.code}`,
                  },
                  {
                    header: "Qty Issued",
                    align: "right",
                    render: (item) => (
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.quantity} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{item.part.unit}</span>
                      </span>
                    ),
                  },
                  { header: "Qty Returned", align: "right", render: (item) => item.returnedQty },
                  { header: "MRP", align: "right", render: (item) => formatCurrency(item.mrp) },
                ] satisfies DataColumn<IssueItem>[]
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5 text-sm">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Status</p>
              <Badge tone={issue.status === "FULLY_RETURNED" ? "success" : issue.status === "PARTIALLY_RETURNED" ? "warning" : "info"}>
                {issue.status.replace("_", " ")}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Reference</p>
              <p className="font-medium text-slate-700 dark:text-slate-300">{issue.reference ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Issued By</p>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {issue.createdBy?.firstName} {issue.createdBy?.lastName}
              </p>
            </div>
            {issue.remarks && (
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Remarks</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{issue.remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

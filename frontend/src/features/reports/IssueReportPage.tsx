import { PackageMinus, Hash, Store as StoreIcon, ArrowUpCircle, Undo2 } from "lucide-react";
import { ReportPage } from "./ReportPage";
import { Badge } from "@/components/ui/Badge";
import { IconFieldRow } from "@/components/ui/IconFieldRow";
import { formatDate } from "@/lib/utils";

interface IssueReportRow {
  issueNumber: string;
  issueDate: string;
  reference: string;
  partNo: string;
  description: string;
  unit: string;
  store: string;
  quantity: number;
  returnedQty: number;
  status: string;
  createdBy: string;
}

function IssueReportMobileCard({ r }: { r: IssueReportRow }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
          <PackageMinus className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={r.description}>
                {r.description}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={r.partNo}>
                {r.partNo}
              </p>
            </div>
            <Badge tone="info" className="shrink-0">{r.status.replace("_", " ")}</Badge>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        <IconFieldRow icon={PackageMinus} label="Issue No" value={r.issueNumber} />
        <IconFieldRow icon={Hash} label="Reference" value={r.reference || "—"} />
        <IconFieldRow icon={StoreIcon} label="Store" value={r.store} />
        <IconFieldRow icon={ArrowUpCircle} iconClassName="text-amber-500 dark:text-amber-400" label="Qty Issued" value={`${r.quantity} ${r.unit}`} emphasize />
        <IconFieldRow icon={Undo2} iconClassName="text-purple-500 dark:text-purple-400" label="Qty Returned" value={`${r.returnedQty} ${r.unit}`} />
      </div>
    </div>
  );
}

export function IssueReportPage() {
  return (
    <ReportPage<IssueReportRow>
      title="Issue Report"
      subtitle="All parts issued from inventory in the selected date range."
      breadcrumbs={["Reports", "Issue Report"]}
      endpoint="/reports/issues"
      exportFilename="Issue-Report"
      rowKey={(r) => `${r.issueNumber}-${r.partNo}`}
      renderMobileCard={(r) => <IssueReportMobileCard r={r} />}
      columns={[
        { header: "Issue No", render: (r) => <span className="font-medium">{r.issueNumber}</span> },
        { header: "Date", render: (r) => formatDate(r.issueDate) },
        { header: "Reference", render: (r) => r.reference || "—" },
        { header: "Part No", render: (r) => r.partNo },
        { header: "Description", render: (r) => r.description },
        { header: "Unit", render: (r) => r.unit },
        { header: "Store", render: (r) => r.store },
        { header: "Qty Issued", align: "right", render: (r) => r.quantity },
        { header: "Qty Returned", align: "right", render: (r) => r.returnedQty },
        { header: "Status", render: (r) => <Badge tone="info">{r.status.replace("_", " ")}</Badge> },
        { header: "Created By", render: (r) => r.createdBy },
      ]}
    />
  );
}

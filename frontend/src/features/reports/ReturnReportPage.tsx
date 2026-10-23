import { Undo2, PackageMinus, User } from "lucide-react";
import { ReportPage } from "./ReportPage";
import { IconFieldRow } from "@/components/ui/IconFieldRow";
import { formatDate } from "@/lib/utils";

interface ReturnReportRow {
  returnNumber: string;
  returnDate: string;
  issueNumber: string;
  partNo: string;
  description: string;
  unit: string;
  quantity: number;
  createdBy: string;
}

function ReturnReportMobileCard({ r }: { r: ReturnReportRow }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
          <Undo2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={r.description}>
            {r.description}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={r.partNo}>
            {r.partNo}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        <IconFieldRow icon={Undo2} label="Return No" value={r.returnNumber} />
        <IconFieldRow icon={PackageMinus} label="Issue No" value={r.issueNumber} />
        <IconFieldRow icon={Undo2} iconClassName="text-purple-500 dark:text-purple-400" label="Qty Returned" value={`${r.quantity} ${r.unit}`} emphasize />
        <IconFieldRow icon={User} label="Created By" value={r.createdBy} />
      </div>
    </div>
  );
}

export function ReturnReportPage() {
  return (
    <ReportPage<ReturnReportRow>
      title="Return Report"
      subtitle="All parts returned to inventory in the selected date range."
      breadcrumbs={["Reports", "Return Report"]}
      endpoint="/reports/returns"
      exportFilename="Return-Report"
      rowKey={(r) => `${r.returnNumber}-${r.partNo}`}
      renderMobileCard={(r) => <ReturnReportMobileCard r={r} />}
      columns={[
        { header: "Return No", render: (r) => <span className="font-medium">{r.returnNumber}</span> },
        { header: "Date", render: (r) => formatDate(r.returnDate) },
        { header: "Issue No", render: (r) => r.issueNumber },
        { header: "Part No", render: (r) => r.partNo },
        { header: "Description", render: (r) => r.description },
        { header: "Unit", render: (r) => r.unit },
        { header: "Qty Returned", align: "right", render: (r) => r.quantity },
        { header: "Created By", render: (r) => r.createdBy },
      ]}
    />
  );
}

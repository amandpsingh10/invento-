import { FileText, Box, Layers, User, ArrowUpCircle, ArrowDownCircle, ChevronRight } from "lucide-react";
import { ReportPage } from "./ReportPage";
import { Badge } from "@/components/ui/Badge";
import { IconFieldRow } from "@/components/ui/IconFieldRow";
import { txnTypeTone } from "@/features/ledger/txnTypeTone";
import { formatDateTime } from "@/lib/utils";
import type { StockTxnType } from "@/types";

interface TransactionReportRow {
  id: string;
  createdAt: string;
  transactionNumber: string;
  transactionType: StockTxnType;
  invoiceNumber: string | null;
  quantityChange: number;
  balanceQuantity: number;
  part: { partNo: string; unit: string };
  createdByName: string;
}

function TransactionReportMobileCard({ r }: { r: TransactionReportRow }) {
  const isPositive = r.quantityChange >= 0;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200">{r.transactionNumber}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(r.createdAt)}</p>
        </div>
        <div className="flex items-center gap-1">
          <Badge tone={txnTypeTone(r.transactionType)}>{r.transactionType}</Badge>
          <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        <IconFieldRow icon={FileText} label="Invoice No" value={r.invoiceNumber ?? "—"} />
        <IconFieldRow icon={Box} label="Part No" value={r.part.partNo} />
        <IconFieldRow
          icon={isPositive ? ArrowUpCircle : ArrowDownCircle}
          iconClassName={isPositive ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}
          label="Qty Change"
          emphasize
          value={
            <span className={isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
              {isPositive ? "+" : ""}
              {r.quantityChange} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{r.part.unit}</span>
            </span>
          }
        />
        <IconFieldRow icon={Layers} label="Balance" value={r.balanceQuantity} />
        <IconFieldRow icon={User} label="Created By" value={r.createdByName} />
      </div>
    </div>
  );
}

export function TransactionReportPage() {
  return (
    <ReportPage<TransactionReportRow>
      title="Transaction Report"
      subtitle="Every stock-changing transaction across purchase, issue, return and adjustment."
      breadcrumbs={["Reports", "Transaction Report"]}
      endpoint="/reports/transactions"
      exportFilename="Transaction-Report"
      rowKey={(r) => r.id}
      renderMobileCard={(r) => <TransactionReportMobileCard r={r} />}
      columns={[
        { header: "Date", render: (r) => formatDateTime(r.createdAt) },
        { header: "Transaction No", render: (r) => <span className="font-medium">{r.transactionNumber}</span> },
        { header: "Type", render: (r) => <Badge tone={txnTypeTone(r.transactionType)}>{r.transactionType}</Badge> },
        { header: "Invoice No", render: (r) => r.invoiceNumber ?? "—" },
        { header: "Part No", render: (r) => r.part.partNo },
        {
          header: "Qty Change",
          align: "right",
          render: (r) => (
            <span className={r.quantityChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
              {r.quantityChange >= 0 ? "+" : ""}
              {r.quantityChange} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{r.part.unit}</span>
            </span>
          ),
        },
        { header: "Balance", align: "right", render: (r) => r.balanceQuantity },
        { header: "Created By", render: (r) => r.createdByName },
      ]}
    />
  );
}

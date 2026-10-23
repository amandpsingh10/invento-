import { Package, Store as StoreIcon, Box, Rows3, TrendingUp, TrendingDown, Undo2, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { ReportPage } from "./ReportPage";
import { IconFieldRow } from "@/components/ui/IconFieldRow";
import { formatNumber } from "@/lib/utils";

interface StockReportRow {
  inventoryId: string;
  partNo: string;
  description: string;
  unit: string;
  store: string;
  bin: string;
  rack: string;
  opening: number;
  purchase: number;
  issue: number;
  return: number;
  adjustment: number;
  closing: number;
}

function StockReportMobileCard({ r }: { r: StockReportRow }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-navy-800 dark:text-slate-500">
          <Package className="h-5 w-5" />
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

      <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-3 text-sm">
        <IconFieldRow icon={StoreIcon} label="Store" value={r.store} />
        <IconFieldRow icon={Box} label="Bin" value={r.bin} />
        <IconFieldRow icon={Rows3} label="Rack" value={r.rack} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-slate-100 pt-3 text-sm dark:border-navy-800">
        <IconFieldRow icon={Package} label="Opening" value={`${formatNumber(r.opening)} ${r.unit}`} />
        <IconFieldRow icon={TrendingUp} iconClassName="text-emerald-500 dark:text-emerald-400" label="Purchase" value={`${formatNumber(r.purchase)} ${r.unit}`} />
        <IconFieldRow icon={TrendingDown} iconClassName="text-red-500 dark:text-red-400" label="Issue" value={`${formatNumber(r.issue)} ${r.unit}`} />
        <IconFieldRow icon={Undo2} iconClassName="text-purple-500 dark:text-purple-400" label="Return" value={`${formatNumber(r.return)} ${r.unit}`} />
        <IconFieldRow icon={SlidersHorizontal} label="Adjustment" value={`${formatNumber(r.adjustment)} ${r.unit}`} />
        <IconFieldRow icon={CheckCircle2} iconClassName="text-brand-500 dark:text-brand-400" label="Closing" value={`${formatNumber(r.closing)} ${r.unit}`} emphasize />
      </div>
    </div>
  );
}

export function StockReportPage() {
  return (
    <ReportPage<StockReportRow>
      title="Stock Report"
      subtitle="Opening, movement and closing stock by part and location."
      breadcrumbs={["Reports", "Stock Report"]}
      endpoint="/reports/stock"
      exportFilename="Stock-Report"
      rowKey={(r) => r.inventoryId}
      renderMobileCard={(r) => <StockReportMobileCard r={r} />}
      columns={[
        { header: "Part No", render: (r) => <span className="font-medium">{r.partNo}</span> },
        { header: "Description", render: (r) => r.description },
        { header: "Unit", render: (r) => r.unit },
        { header: "Store", render: (r) => r.store },
        { header: "Bin", render: (r) => r.bin },
        { header: "Rack", render: (r) => r.rack },
        { header: "Opening", align: "right", render: (r) => formatNumber(r.opening) },
        { header: "Purchase", align: "right", render: (r) => formatNumber(r.purchase) },
        { header: "Issue", align: "right", render: (r) => formatNumber(r.issue) },
        { header: "Return", align: "right", render: (r) => formatNumber(r.return) },
        { header: "Adjustment", align: "right", render: (r) => formatNumber(r.adjustment) },
        { header: "Closing Stock", align: "right", render: (r) => <span className="font-semibold">{formatNumber(r.closing)}</span> },
      ]}
    />
  );
}

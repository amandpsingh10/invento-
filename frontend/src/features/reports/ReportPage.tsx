import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Calendar, Tag } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import type { PagedResult } from "@/types";
import { PageHeader, Pagination } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { saveFileToDevice } from "@/lib/nativeFile";
import { PART_CATEGORIES, PART_CATEGORY_LABELS } from "@/lib/partCategory";

export type ReportColumn<T> = DataColumn<T>;

export function ReportPage<T>({
  title,
  subtitle,
  breadcrumbs,
  endpoint,
  exportFilename,
  columns,
  rowKey,
  renderMobileCard,
}: {
  title: string;
  subtitle: string;
  breadcrumbs: string[];
  endpoint: string;
  exportFilename: string;
  columns: ReportColumn<T>[];
  rowKey: (row: T) => string;
  renderMobileCard?: (row: T) => ReactNode;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { push } = useToast();

  const params = { from: from || undefined, to: to || undefined, category: category || undefined, page, pageSize };

  const { data, isLoading } = useQuery({
    queryKey: [endpoint, params],
    queryFn: async () => (await apiClient.get<{ data: PagedResult<T> }>(endpoint, { params })).data.data,
  });

  async function exportExcel() {
    const res = await apiClient.get(endpoint, { params: { ...params, export: "excel", pageSize: 5000 }, responseType: "blob" });
    const file = new File([res.data], `${exportFilename}.xlsx`, {
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
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        actions={
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download className="h-4 w-4" /> Export Excel
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4 dark:border-navy-800">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">From</label>
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
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">To</label>
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
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Category</label>
            <div className="relative">
              <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                className="w-48 rounded-full pl-9"
              >
                <option value="">All Categories</option>
                {PART_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PART_CATEGORY_LABELS[c]} ({c})
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          items={data?.items ?? []}
          rowKey={rowKey}
          isLoading={isLoading}
          emptyTitle="No data for the selected range"
          renderMobileCard={renderMobileCard}
        />
        {data && data.total > 0 && (
          <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, PackageMinus } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import type { LowStockRow, PagedResult, Store } from "@/types";
import { PageHeader, Pagination } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Badge, stockStatusTone, stockStatusLabel } from "@/components/ui/Badge";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { formatCurrency, formatNumber } from "@/lib/utils";

export function LowStockPage() {
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => (await apiClient.get<{ data: Store[] }>("/stores")).data.data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["low-stock", { search, storeId, page }],
    queryFn: async () =>
      (
        await apiClient.get<{ data: PagedResult<LowStockRow> & { lowStockThreshold: number } }>("/inventory/low-stock", {
          params: { search: search || undefined, storeId: storeId || undefined, page, pageSize },
        })
      ).data.data,
  });

  return (
    <div>
      <PageHeader
        title="Low Stock"
        subtitle={data ? `Parts with available quantity below ${data.lowStockThreshold}, lowest first.` : "Loading..."}
        breadcrumbs={["Inventory", "Low Stock"]}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-navy-800 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Search Part No or Description..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select value={storeId} onChange={(e) => { setStoreId(e.target.value); setPage(1); }} className="w-44">
            <option value="">All Stores</option>
            {stores?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        <DataTable<LowStockRow>
          isLoading={isLoading}
          items={data?.items ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No low-stock parts"
          emptyDescription="Every part is currently above the low-stock threshold. Nice work."
          columns={
            [
              { header: "Part No", render: (row) => <span className="font-medium text-slate-800 dark:text-slate-200">{row.partNo}</span> },
              { header: "Description", render: (row) => row.description },
              { header: "Category", render: (row) => <CategoryBadge category={row.category} /> },
              { header: "Store", render: (row) => row.store.name ?? row.store.code },
              { header: "Bin", render: (row) => row.bin.code },
              { header: "Rack", render: (row) => row.rack.code },
              { header: "MRP", align: "right", render: (row) => formatCurrency(row.mrp) },
              {
                header: "Avail. Qty",
                align: "right",
                render: (row) => (
                  <span className={`font-semibold ${row.status === "OUT_OF_STOCK" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {formatNumber(row.availableQty)} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{row.unit}</span>
                  </span>
                ),
              },
              { header: "Status", render: (row) => <Badge tone={stockStatusTone(row.status)}>{stockStatusLabel(row.status)}</Badge> },
              {
                header: "Actions",
                align: "right",
                render: (row) => (
                  <Link
                    to={`/sell/new?inventoryId=${row.id}`}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:text-slate-500 dark:hover:bg-brand-500/15 dark:hover:text-brand-400"
                    title="Sell"
                  >
                    <PackageMinus className="h-4 w-4" />
                  </Link>
                ),
              },
            ] satisfies DataColumn<LowStockRow>[]
          }
        />
        {data && data.total > 0 && (
          <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Search,
  PackageMinus,
  History,
  ShoppingCart,
  Store as StoreIcon,
  Filter,
  Tag,
  Rows3,
  Box,
  Coins,
  Package,
  MoreVertical,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import type { InventoryRow, PagedResult, Store } from "@/types";
import { PageHeader, Pagination } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Badge, stockStatusTone, stockStatusLabel } from "@/components/ui/Badge";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { IconFieldRow } from "@/components/ui/IconFieldRow";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { PART_CATEGORY_LABELS, type PartCategoryCode } from "@/lib/partCategory";

/**
 * Bespoke mobile card for Current Stock — richer than DataTable's generic
 * label/value card (a thumbnail slot, icon-led fields, Sell/Issue as
 * labeled buttons with a "more" menu for History) per the reference
 * design. This doesn't touch DataTable's default card, which every other
 * page using it still gets unchanged — see its `renderMobileCard` prop.
 */
function CurrentStockMobileCard({ row }: { row: InventoryRow }) {
  const categoryCode = row.category as PartCategoryCode;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card dark:border-navy-700 dark:bg-navy-900">
      <div className="flex gap-3 p-4">
        {/* No part-photo feature exists yet — this is a placeholder slot, not a stand-in for a real image. */}
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300 dark:bg-navy-800 dark:text-slate-600">
          <Package className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display truncate text-base font-bold text-slate-900 dark:text-slate-100" title={row.description}>
              {row.description}
            </p>
            <Badge tone={stockStatusTone(row.status)} className="shrink-0">
              {stockStatusLabel(row.status)}
            </Badge>
          </div>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400" title={row.partNo}>
            {row.partNo}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pb-3 text-xs">
        <IconFieldRow icon={Tag} label="Category" value={`${categoryCode} — ${PART_CATEGORY_LABELS[categoryCode] ?? row.category}`} />
        <IconFieldRow icon={StoreIcon} label="Store" value={row.store.name ?? row.store.code} />
        <IconFieldRow icon={Rows3} label="Rack" value={row.rack.code} />
        <IconFieldRow icon={Box} label="Bin" value={row.bin.code} />
        <IconFieldRow icon={Coins} label="MRP" value={formatCurrency(row.mrp)} />
        <IconFieldRow icon={Package} label="Available Qty" value={`${formatNumber(row.availableQty)} ${row.unit}`} emphasize />
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 dark:border-navy-800 px-3 py-2.5">
        <Link
          to={`/sell/new?inventoryId=${row.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-50 py-2 text-sm font-semibold text-brand-600 active:scale-[0.98] dark:bg-brand-500/15 dark:text-brand-400"
        >
          <ShoppingCart className="h-4 w-4" /> Sell
        </Link>
        <Link
          to={`/issues/new?inventoryId=${row.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-2 text-sm font-semibold text-emerald-600 active:scale-[0.98] dark:bg-emerald-500/10 dark:text-emerald-400"
        >
          <PackageMinus className="h-4 w-4" /> Issue
        </Link>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-navy-800 dark:text-slate-400 dark:hover:bg-navy-700">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-50 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-navy-700 dark:bg-navy-900">
              <DropdownMenu.Item asChild>
                <Link
                  to={`/inventory/${row.id}/history`}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-600 outline-none hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-navy-800"
                >
                  <History className="h-4 w-4" /> Stock History
                </Link>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}

export function CurrentStockPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [storeId, setStoreId] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => (await apiClient.get<{ data: Store[] }>("/stores")).data.data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", { search, status, storeId, page }],
    queryFn: async () =>
      (
        await apiClient.get<{ data: PagedResult<InventoryRow> }>("/inventory", {
          params: { search: search || undefined, status: status || undefined, storeId: storeId || undefined, page, pageSize },
        })
      ).data.data,
  });

  return (
    <div>
      <PageHeader title="Current Stock" subtitle="Real-time available stock by part, store, bin and rack." breadcrumbs={["Inventory", "Current Stock"]} />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-navy-800 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Search Part No or Description..."
              className="rounded-full pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="relative">
            <StoreIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Select
              value={storeId}
              onChange={(e) => {
                setStoreId(e.target.value);
                setPage(1);
              }}
              className="w-44 rounded-full pl-9"
            >
              <option value="">All Stores</option>
              {stores?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-44 rounded-full pl-9"
            >
              <option value="">All Status</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </Select>
          </div>
        </div>

        <DataTable<InventoryRow>
          isLoading={isLoading}
          items={data?.items ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No stock records found"
          emptyDescription="Upload a purchase or adjust your filters to see inventory here."
          renderMobileCard={(row) => <CurrentStockMobileCard row={row} />}
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
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatNumber(row.availableQty)} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{row.unit}</span>
                  </span>
                ),
              },
              { header: "Status", render: (row) => <Badge tone={stockStatusTone(row.status)}>{stockStatusLabel(row.status)}</Badge> },
              {
                header: "Actions",
                align: "right",
                render: (row) => (
                  <div className="flex justify-end gap-1">
                    <Link
                      to={`/sell/new?inventoryId=${row.id}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:text-slate-500 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                      title="Sell"
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </Link>
                    <Link
                      to={`/issues/new?inventoryId=${row.id}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:text-slate-500 dark:hover:bg-brand-500/15 dark:hover:text-brand-400"
                      title="Issue"
                    >
                      <PackageMinus className="h-4 w-4" />
                    </Link>
                    <Link
                      to={`/inventory/${row.id}/history`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-navy-800 dark:hover:text-slate-300"
                      title="Stock History"
                    >
                      <History className="h-4 w-4" />
                    </Link>
                  </div>
                ),
              },
            ] satisfies DataColumn<InventoryRow>[]
          }
        />

        {data && data.total > 0 && (
          <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TableSkeleton, EmptyState } from "./Feedback";

export interface DataColumn<T> {
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
  className?: string;
}

/**
 * Renders a list as a normal table from md upward, and as one card per row
 * below md. The first column becomes each card's title; a column literally
 * named "Status" (if present) is pulled up next to the title as a badge
 * instead of buried mid-list, since status is normally the thing someone
 * scans a card list for; a column literally named "Actions" (if present)
 * renders as its own footer strip instead of a label/value row, since
 * action buttons aren't a name-value pair. Every remaining column renders
 * in a compact 2-up grid. Matching by header text keeps this generic
 * (DataTable has no idea what the row data actually is) while still
 * looking right for the convention almost every table in this app follows.
 */
export function DataTable<T>({
  columns,
  items,
  rowKey,
  isLoading,
  emptyTitle,
  emptyDescription,
  emptyAction,
  renderMobileCard,
}: {
  columns: DataColumn<T>[];
  items: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Opt-in full replacement for a row's mobile card — the desktop table above still comes from `columns` either way. Use when a page's mobile layout needs to diverge from the generic label/value card (e.g. a thumbnail, icon-led fields, bespoke actions). */
  renderMobileCard?: (row: T) => ReactNode;
}) {
  if (isLoading) return <TableSkeleton cols={columns.length} />;
  if (!items.length) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;

  const [primaryCol, ...restCols] = columns;
  const statusCol = restCols.find((c) => c.header.toLowerCase() === "status");
  const actionsCol = restCols.find((c) => c.header.toLowerCase() === "actions");
  const gridCols = restCols.filter((c) => c !== statusCol && c !== actionsCol);

  return (
    <>
      <div className="hidden overflow-x-auto thin-scroll md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-navy-800 dark:bg-navy-800/40 dark:text-slate-400">
            <tr>
              {columns.map((c) => (
                <th key={c.header} className={cn("px-5 py-3", c.align === "right" && "text-right")}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {items.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-slate-50/60 dark:hover:bg-navy-800/40">
                {columns.map((c) => (
                  <td key={c.header} className={cn("px-5 py-3 text-slate-700 dark:text-slate-300", c.align === "right" && "text-right", c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 bg-slate-50/60 p-3 dark:bg-navy-950/40 md:hidden">
        {items.map((row) =>
          renderMobileCard ? (
            <div key={rowKey(row)}>{renderMobileCard(row)}</div>
          ) : (
            <div
              key={rowKey(row)}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-all duration-150 active:scale-[0.99] dark:border-navy-700 dark:bg-navy-900"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-navy-800">
                {(() => {
                  const primaryRendered = primaryCol.render(row);
                  return (
                    <div
                      className="font-display min-w-0 truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100"
                      title={typeof primaryRendered === "string" ? primaryRendered : undefined}
                    >
                      {primaryRendered}
                    </div>
                  );
                })()}
                {statusCol && <div className="shrink-0">{statusCol.render(row)}</div>}
              </div>

              {gridCols.length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3">
                  {gridCols.map((c) => {
                    const rendered = c.render(row);
                    return (
                      <div key={c.header} className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{c.header}</p>
                        <div className="mt-0.5 truncate text-sm text-slate-700 dark:text-slate-300" title={typeof rendered === "string" ? rendered : undefined}>
                          {rendered}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {actionsCol && (
                <div className="flex items-center justify-end gap-1 border-t border-slate-100 bg-slate-50/60 px-3 py-2 dark:border-navy-800 dark:bg-navy-950/40">
                  {actionsCol.render(row)}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </>
  );
}

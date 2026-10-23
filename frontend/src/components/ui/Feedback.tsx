import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNativePlatform } from "@/lib/platform";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-navy-800 dark:text-slate-500">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  hideBack,
  onBack,
}: {
  title: string;
  subtitle?: string;
  breadcrumbs?: string[];
  actions?: ReactNode;
  /** Set on the Home screen (and other true top-level landing pages) — every other screen gets a Back button by default. */
  hideBack?: boolean;
  /** Override the default navigate(-1), e.g. to confirm discarding unsaved changes first. */
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="mb-6">
      {/* The native Android app handles Back via the hardware/gesture
          button (see hardwareBack.ts) — an in-screen Back button next to
          that reads as duplicated chrome, so it only renders on web. */}
      {!hideBack && !isNativePlatform() && (
        <button
          onClick={() => (onBack ? onBack() : navigate(-1))}
          className="mb-3 inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-slate-500 hover:text-slate-800 active:scale-[0.98] dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {breadcrumbs && (
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
              {breadcrumbs.map((b, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span>/</span>}
                  <span>{b}</span>
                </span>
              ))}
            </div>
          )}
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
  pageSize,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total: number;
  pageSize: number;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-navy-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Showing <span className="font-medium text-slate-700 dark:text-slate-300">{start}</span>–<span className="font-medium text-slate-700 dark:text-slate-300">{end}</span> of{" "}
        <span className="font-medium text-slate-700 dark:text-slate-300">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-800"
        >
          Prev
        </button>
        <span className="px-2 text-xs text-slate-500 dark:text-slate-400">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-800"
        >
          Next
        </button>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** One icon-led label/value pair, used inside bespoke mobile cards (Current Stock, Stock Ledger, ...) that opt out of DataTable's generic card via `renderMobileCard`. */
export function IconFieldRow({
  icon: Icon,
  iconClassName,
  label,
  value,
  emphasize,
  title,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: ReactNode;
  emphasize?: boolean;
  /** Tooltip for the truncated value — auto-derived when value is a plain string, since callers pass JSX (e.g. a Badge) too often to require this explicitly everywhere. */
  title?: string;
}) {
  const resolvedTitle = title ?? (typeof value === "string" ? value : undefined);
  return (
    <div className="flex items-start gap-2">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600", iconClassName)} />
      <div className="min-w-0">
        <p className="text-slate-400 dark:text-slate-500">{label}</p>
        <div className={cn("truncate font-medium text-slate-700 dark:text-slate-300", emphasize && "font-semibold text-slate-900 dark:text-slate-100")} title={resolvedTitle}>
          {value}
        </div>
      </div>
    </div>
  );
}

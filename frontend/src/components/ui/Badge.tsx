import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

const toneClasses: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
  danger: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30",
  info: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30",
  neutral: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-navy-800 dark:text-slate-400 dark:ring-navy-700",
  purple: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/30",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("status-badge transition-colors duration-150", toneClasses[tone], className)} {...props} />;
}

const dotClasses: Record<Tone, string> = {
  success: "bg-emerald-500 dark:bg-emerald-400",
  warning: "bg-amber-500 dark:bg-amber-400",
  danger: "bg-red-500 dark:bg-red-400",
  info: "bg-blue-500 dark:bg-blue-400",
  neutral: "bg-slate-400 dark:bg-slate-500",
  purple: "bg-purple-500 dark:bg-purple-400",
};

const dotTextClasses: Record<Tone, string> = {
  success: "text-emerald-700 dark:text-emerald-400",
  warning: "text-amber-700 dark:text-amber-400",
  danger: "text-red-700 dark:text-red-400",
  info: "text-blue-700 dark:text-blue-400",
  neutral: "text-slate-600 dark:text-slate-400",
  purple: "text-purple-700 dark:text-purple-400",
};

/**
 * The web-view "Status" column's badge: a dense dot + label on the actual
 * table (md and up), same tone, same label. Below md — the generic mobile
 * card DataTable falls back to — this single render function is also what
 * gets reused, so it switches back to Badge's pill there instead: a bare
 * dot reads fine inline in a table row but gets lost pulled up into a
 * mobile card's corner on its own.
 */
export function StatusDot({ tone = "neutral", className, children, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <>
      <Badge tone={tone} className={cn("md:hidden", className)} {...props}>
        {children}
      </Badge>
      <span className={cn("hidden items-center gap-1.5 text-[13px] font-medium md:inline-flex", dotTextClasses[tone], className)} {...props}>
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClasses[tone])} />
        {children}
      </span>
    </>
  );
}

export function stockStatusTone(status: string): Tone {
  if (status === "OUT_OF_STOCK") return "danger";
  if (status === "LOW_STOCK") return "warning";
  return "success";
}

export function stockStatusLabel(status: string): string {
  if (status === "OUT_OF_STOCK") return "Out of Stock";
  if (status === "LOW_STOCK") return "Low Stock";
  return "In Stock";
}

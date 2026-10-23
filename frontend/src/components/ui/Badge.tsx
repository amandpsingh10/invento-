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

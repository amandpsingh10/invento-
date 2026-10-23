import {
  CheckCircle2,
  PackageCheck,
  XCircle,
  AlertTriangle,
  Info,
  PackageMinus,
  SlidersHorizontal,
  KeyRound,
  UserPlus,
  Bell,
  type LucideIcon,
} from "lucide-react";

/** Notification types that represent something needing attention, as opposed to a routine confirmation — drives the "Alerts" filter tab. */
export const ALERT_NOTIFICATION_TYPES = new Set(["LOW_STOCK", "OUT_OF_STOCK", "INVOICE_CANCELLED", "PURCHASE_FAILED"]);

interface NotificationVisual {
  icon: LucideIcon;
  iconTone: string;
}

const NOTIFICATION_VISUALS: Record<string, NotificationVisual> = {
  SALE_SUCCESS: { icon: CheckCircle2, iconTone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" },
  RETURN_SUCCESS: { icon: PackageCheck, iconTone: "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400" },
  INVOICE_CANCELLED: { icon: XCircle, iconTone: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" },
  LOW_STOCK: { icon: AlertTriangle, iconTone: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" },
  OUT_OF_STOCK: { icon: AlertTriangle, iconTone: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" },
  PART_ADDED: { icon: Info, iconTone: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" },
  PURCHASE_SUCCESS: { icon: Info, iconTone: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" },
  PURCHASE_FAILED: { icon: XCircle, iconTone: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" },
  ISSUE_SUCCESS: { icon: PackageMinus, iconTone: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400" },
  ADJUSTMENT_SUCCESS: { icon: SlidersHorizontal, iconTone: "bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-400" },
  PASSWORD_RESET: { icon: KeyRound, iconTone: "bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-400" },
  USER_CREATED: { icon: UserPlus, iconTone: "bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-400" },
  SYSTEM: { icon: Bell, iconTone: "bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-400" },
};

export function notificationVisual(type: string): NotificationVisual {
  return NOTIFICATION_VISUALS[type] ?? { icon: Bell, iconTone: "bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-400" };
}

import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type LabelHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-150 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-400 dark:border-navy-600 dark:bg-navy-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-navy-950 dark:disabled:text-slate-500",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-150 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-navy-600 dark:bg-navy-900 dark:text-slate-100 dark:placeholder:text-slate-500",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 transition-colors duration-150 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 dark:border-navy-600 dark:bg-navy-900 dark:text-slate-100 dark:disabled:bg-navy-950",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300", className)} {...props} />;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{message}</p>;
}

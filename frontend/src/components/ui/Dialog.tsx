import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in dark:bg-black/60" />
        <RadixDialog.Content
          className={cn(
            // Mobile: a narrow, comfortably-inset card (~320px max, 20px
            // margin either side) rather than edge-to-edge full width.
            // sm+ (640px): reverts to the roomier fixed max-width used on
            // desktop.
            "fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2.5rem)] max-w-[320px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl focus:outline-none dark:bg-navy-900 sm:w-full sm:max-w-lg sm:p-6",
            className
          )}
        >
          <div className="mb-4 flex items-start justify-between">
            <div>
              <RadixDialog.Title className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</RadixDialog.Title>
              {description && <RadixDialog.Description className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</RadixDialog.Description>}
            </div>
            <RadixDialog.Close className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-navy-800 dark:hover:text-slate-300">
              <X className="h-4 w-4" />
            </RadixDialog.Close>
          </div>
          {children}
          {footer && <div className="mt-6 flex flex-col-reverse gap-2 [&>*]:w-full sm:flex-row sm:justify-end sm:[&>*]:w-auto">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, Ban, Undo2 } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { Invoice } from "@/types";
import { PageHeader, Skeleton } from "@/components/ui/Feedback";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea, Label } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatCurrency } from "@/lib/utils";
import { discountAmount } from "@/lib/invoicePdf";

const STATUS_TONE: Record<string, any> = { DRAFT: "neutral", COMPLETED: "success", CANCELLED: "danger" };

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const { push } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => (await apiClient.get<{ data: Invoice }>(`/invoices/${id}`)).data.data,
  });

  const cancelInvoice = useMutation({
    mutationFn: async () => apiClient.post(`/invoices/${id}/cancel`, { reason }),
    onSuccess: () => {
      push({ tone: "success", title: "Invoice cancelled", description: `Invoice ${invoice?.invoiceNumber} cancelled successfully.` });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setCancelOpen(false);
    },
    onError: (err) => push({ tone: "error", title: "Unable to cancel invoice", description: getApiErrorMessage(err) }),
  });

  function handleConfirmCancel() {
    if (!reason.trim()) {
      setReasonError("A cancellation reason is required");
      return;
    }
    setReasonError(null);
    cancelInvoice.mutate();
  }

  if (isLoading || !invoice) {
    return (
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        subtitle={formatDate(invoice.invoiceDate)}
        breadcrumbs={["Part Sell", "Sales History", invoice.invoiceNumber]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(`/invoices/${invoice.id}/print`)}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            {invoice.status === "COMPLETED" && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setReason("");
                  setReasonError(null);
                  setCancelOpen(true);
                }}
              >
                <Ban className="h-4 w-4" /> Cancel Invoice
              </Button>
            )}
            {invoice.status === "CANCELLED" && (
              <Link to={`/returns/new?invoiceNumber=${invoice.invoiceNumber}`}>
                <Button size="sm">
                  <Undo2 className="h-4 w-4" /> Return
                </Button>
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-navy-800 dark:bg-navy-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Part</th>
                  <th className="px-5 py-3 text-right">Qty</th>
                  <th className="px-5 py-3 text-right">Price</th>
                  <th className="px-5 py-3 text-right">Tax</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{item.part.description}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.part.partNo}</p>
                      <CategoryBadge category={item.part.category} className="mt-1" />
                      {item.returnedQty > 0 && <p className="text-xs text-purple-600 dark:text-purple-400">{item.returnedQty} returned</p>}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                      {item.quantity} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{item.part.unit}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">
                      {formatCurrency(item.sellingPrice)}
                      {discountAmount(item) > 0 && (
                        <p className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(discountAmount(item))} off MRP {formatCurrency(item.part.mrp)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(item.taxAmount)}</td>
                    <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end border-t border-slate-100 dark:border-navy-800 p-4">
              <div className="w-56 text-sm">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Tax</span>
                  <span>{formatCurrency(invoice.taxAmount)}</span>
                </div>
                <div className="mt-1 flex justify-between text-base font-bold text-slate-900 dark:text-slate-100">
                  <span>Grand Total</span>
                  <span>{formatCurrency(invoice.grandTotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5 text-sm">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Status</p>
              <Badge tone={STATUS_TONE[invoice.status] ?? "neutral"}>{invoice.status}</Badge>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Customer</p>
              <p className="font-medium text-slate-700 dark:text-slate-300">{invoice.customer.name}</p>
              <p className="text-slate-500 dark:text-slate-400">{invoice.customer.mobile}</p>
              <p className="text-slate-500 dark:text-slate-400">{invoice.customer.address}</p>
              {invoice.customer.gstin && <p className="text-slate-500 dark:text-slate-400">GSTIN: {invoice.customer.gstin}</p>}
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Sold By</p>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {invoice.createdBy?.firstName} {invoice.createdBy?.lastName}
              </p>
            </div>
            {invoice.status === "CANCELLED" && (
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Cancelled By</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  {invoice.cancelledBy?.firstName} {invoice.cancelledBy?.lastName}
                </p>
                {invoice.cancellationReason && <p className="mt-1 text-slate-500 dark:text-slate-400">{invoice.cancellationReason}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel Invoice"
        description={`Are you sure you want to cancel Invoice ${invoice.invoiceNumber}? Invoice cancellation is required before returning sold parts.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmCancel} isLoading={cancelInvoice.isPending}>
              Confirm Cancellation
            </Button>
          </>
        }
      >
        <div>
          <Label>Reason *</Label>
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError) setReasonError(null);
            }}
          />
          {reasonError && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{reasonError}</p>}
        </div>
      </Dialog>
    </div>
  );
}

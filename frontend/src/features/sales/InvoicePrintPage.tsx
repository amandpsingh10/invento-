import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer, Download, Share2, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import type { Invoice } from "@/types";
import { Skeleton } from "@/components/ui/Feedback";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/branding";
import { buildInvoicePdfFile, savePdfToDevice, shareFile, discountAmount, INVOICE_TERMS, type HandoffResult } from "@/lib/invoicePdf";
import { isNativePlatform } from "@/lib/platform";

/** Plain "X,XXX.XX" with no currency symbol — the invoice document (screen and print) intentionally shows no rupee sign anywhere, unlike amt() used everywhere else in the app. */
function amt(value: unknown): string {
  return Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Aggregate CGST/SGST/IGST across every line — items can in principle carry different rates, so these are summed rather than assumed uniform. */
function sumGst(invoice: Invoice) {
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  for (const item of invoice.items) {
    cgst += Number(item.cgstAmount);
    sgst += Number(item.sgstAmount);
    igst += Number(item.igstAmount);
  }
  return { cgst, sgst, igst };
}

/**
 * Two rendering modes of the same invoice data:
 *  - SCREEN (default): mobile-friendly stacked cards, readable without
 *    zooming on a 360-414px phone.
 *  - PRINT (.print-only, @media print): a clean tabular A4 layout — see
 *    @page/no-print/print-only rules in index.css. Only invoice content
 *    prints; app chrome (Topbar/BottomNav) and these action buttons never
 *    do (.no-print / the global `nav`+`header` print hide).
 *
 * Android's stock WebView (what the Capacitor APK embeds) has no print
 * engine at all — window.print() is a guaranteed no-op there, not a CSS
 * problem, and its blob: URL + <a download> combo has no download manager
 * behind it either, so a claimed "PDF saved" was actually false. Both
 * Print and Save PDF route through the OS share sheet on native platforms
 * instead (savePdfToDevice/shareFile in lib/invoicePdf.ts) — the one
 * mechanism that reliably reaches Android's filesystem/print services from
 * inside a WebView. Real browsers keep window.print() and a direct
 * download, which both work natively there.
 */
export function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { push } = useToast();
  const [busy, setBusy] = useState<"print" | "save" | "share" | null>(null);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => (await apiClient.get<{ data: Invoice }>(`/invoices/${id}`)).data.data,
  });

  const dealerName = invoice?.tenant?.name ?? "AMAN ENTERPRISES";
  const dealerAddress = invoice?.tenant?.address;

  useEffect(() => {
    if (invoice && params.get("download") === "1") {
      const t = setTimeout(() => attemptPrint(), 300);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice, params]);

  function reportOutcome(result: HandoffResult, action: "printed" | "saved" | "shared") {
    if (result === "shared") {
      push({ tone: "success", title: "Choose where to save", description: 'Pick "Save to Files", "Drive", or a Print service from the menu that opened.' });
    } else if (result === "downloaded") {
      push({ tone: "success", title: action === "printed" ? "Print dialog opened" : "Invoice PDF downloaded" });
    } else if (result === "unsupported") {
      push({
        tone: "info",
        title: "Not supported in this app",
        description: 'This action isn\'t available here. Please open this invoice in a phone browser instead of the app, or try "Share".',
      });
    }
    // "cancelled" (user backed out of the share sheet) — no toast needed.
  }

  async function attemptPrint() {
    if (!invoice) return;
    setBusy("print");
    try {
      if (isNativePlatform()) {
        const file = await buildInvoicePdfFile(invoice, dealerName, dealerAddress);
        reportOutcome(await shareFile(file, `Invoice ${invoice.invoiceNumber}`), "printed");
      } else {
        window.print();
      }
    } catch {
      push({ tone: "error", title: "Unable to print", description: 'Try "Save PDF" or "Share" instead.' });
    } finally {
      setBusy(null);
    }
  }

  async function savePdf() {
    if (!invoice) return;
    setBusy("save");
    try {
      const file = await buildInvoicePdfFile(invoice, dealerName, dealerAddress);
      reportOutcome(await savePdfToDevice(file), "saved");
    } catch {
      push({ tone: "error", title: "Unable to generate PDF", description: "Try again, or use Share instead." });
    } finally {
      setBusy(null);
    }
  }

  async function shareInvoice() {
    if (!invoice) return;
    setBusy("share");
    try {
      const file = await buildInvoicePdfFile(invoice, dealerName, dealerAddress);
      reportOutcome(await shareFile(file, `Invoice ${invoice.invoiceNumber}`), "shared");
    } catch {
      push({ tone: "error", title: "Unable to share", description: "Try Save PDF instead." });
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || !invoice) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-96 w-full" />
      </div>
    );
  }

  const gst = sumGst(invoice);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Action bar — screen only, never prints */}
      <div className="no-print mb-4 flex flex-wrap justify-end gap-2 px-4 pt-4 sm:px-0 sm:pt-0">
        <button
          onClick={shareInvoice}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share
        </button>
        <button
          onClick={savePdf}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {isNativePlatform() ? "Save PDF" : "Download PDF"}
        </button>
        <button
          onClick={attemptPrint}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy === "print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Print
        </button>
      </div>

      {/* ---------------- SCREEN VIEW (mobile-friendly cards) ---------------- */}
      <div className="no-print space-y-3 px-4 pb-8 sm:px-0">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <p className="text-base font-extrabold tracking-tight text-slate-900">{PRODUCT_NAME}</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{dealerName}</p>
          {dealerAddress && <p className="text-xs text-slate-500">{dealerAddress}</p>}
          {invoice.tenant?.gstin && <p className="mt-1 text-xs text-slate-500">GSTIN: {invoice.tenant.gstin}</p>}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice</p>
              <p className="text-lg font-bold text-slate-900">{invoice.invoiceNumber}</p>
              <p className="mt-0.5 text-xs text-slate-500">Date: {formatDate(invoice.invoiceDate)}</p>
            </div>
            <Badge tone={invoice.status === "CANCELLED" ? "danger" : "success"}>{invoice.status}</Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Customer</p>
          <div className="space-y-1 text-sm">
            <p className="font-medium text-slate-800">{invoice.customer.name}</p>
            <p className="text-slate-600">{invoice.customer.mobile}</p>
            {invoice.customer.address && <p className="text-slate-600">{invoice.customer.address}</p>}
            {(invoice.customer.city || invoice.customer.state || invoice.customer.pincode) && (
              <p className="text-slate-600">
                {[invoice.customer.city, invoice.customer.state, invoice.customer.pincode].filter(Boolean).join(", ")}
              </p>
            )}
            {invoice.customer.gstin && <p className="text-slate-600">GSTIN: {invoice.customer.gstin}</p>}
          </div>
        </div>

        <div className="space-y-2">
          {invoice.items.map((item) => {
            const disc = discountAmount(item);
            return (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                <p className="text-sm font-semibold text-slate-900">{item.part.partNo}</p>
                <p className="text-xs text-slate-500">{item.part.description}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <p>
                    Qty: <span className="font-medium text-slate-800">{item.quantity} {item.part.unit}</span>
                  </p>
                  <p>
                    MRP: <span className="font-medium text-slate-800">{amt(item.part.mrp)}</span>
                  </p>
                  <p>
                    Discount: <span className="font-medium text-slate-800">{disc > 0 ? amt(disc) : "—"}</span>
                  </p>
                  <p>
                    Price: <span className="font-medium text-slate-800">{amt(item.sellingPrice)}</span>
                  </p>
                  <p>
                    Tax: <span className="font-medium text-slate-800">{item.taxPercent}%</span>
                  </p>
                  <p>
                    Amount: <span className="font-semibold text-slate-900">{amt(item.lineTotal)}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card text-sm">
          <div className="flex justify-between py-1 text-slate-600">
            <span>Subtotal</span>
            <span>{amt(invoice.subtotal)}</span>
          </div>
          {gst.cgst > 0 || gst.sgst > 0 ? (
            <>
              <div className="flex justify-between py-1 text-slate-600">
                <span>CGST</span>
                <span>{amt(gst.cgst)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>SGST</span>
                <span>{amt(gst.sgst)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between py-1 text-slate-600">
              <span>IGST</span>
              <span>{amt(gst.igst)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-slate-900">
            <span>Total</span>
            <span>{amt(invoice.grandTotal)}</span>
          </div>
        </div>

        {invoice.status === "CANCELLED" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            This invoice was cancelled{invoice.cancelledBy ? ` by ${invoice.cancelledBy.firstName} ${invoice.cancelledBy.lastName}` : ""}
            {invoice.cancellationReason ? `: ${invoice.cancellationReason}` : "."}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Terms &amp; Conditions</p>
          <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-slate-500">
            {INVOICE_TERMS.map((term, i) => (
              <li key={i}>{term}</li>
            ))}
          </ol>
        </div>

        <p className="py-2 text-center text-xs text-slate-400">Thank you for choosing us.</p>
      </div>

      {/* ---------------- PRINT VIEW (clean A4 table layout) ---------------- */}
      <div className="print-only bg-white p-0 text-black">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-lg font-bold text-navy-950">{dealerName}</p>
            {dealerAddress && <p className="text-xs text-slate-500">{dealerAddress}</p>}
            {invoice.tenant?.gstin && <p className="mt-0.5 text-xs text-slate-500">GSTIN: {invoice.tenant.gstin}</p>}
          </div>
          <Badge tone={invoice.status === "CANCELLED" ? "danger" : "success"}>{invoice.status}</Badge>
        </div>

        {/* items-start stops the CSS Grid default of stretching each
            <table> (a grid item) to match the height of its sibling — the
            invoice/date table only has 2 rows vs. the customer table's up
            to 6, so without this the shorter table's rows were inflated to
            fill the extra height, and since the value cells lacked
            align-top (defaulting to vertical-align: middle) they visibly
            dropped away from their label within that inflated row. Every
            value cell now also gets align-top directly, as a second,
            independent guard against the same drift. */}
        <div className="mt-4 grid grid-cols-2 items-start gap-6 text-xs">
          <table className="w-full table-fixed border-collapse">
            <tbody>
              <tr>
                <td className="w-24 py-1 align-top font-semibold uppercase tracking-wide text-slate-400">Invoice No</td>
                <td className="cell-wrap py-1 align-top font-medium text-slate-800">{invoice.invoiceNumber}</td>
              </tr>
              <tr>
                <td className="py-1 align-top font-semibold uppercase tracking-wide text-slate-400">Date</td>
                <td className="cell-wrap py-1 align-top text-slate-700">{formatDate(invoice.invoiceDate)}</td>
              </tr>
            </tbody>
          </table>
          <table className="w-full table-fixed border-collapse">
            <tbody>
              <tr>
                <td className="w-24 py-1 align-top font-semibold uppercase tracking-wide text-slate-400">Customer</td>
                <td className="cell-wrap py-1 align-top font-medium text-slate-800">{invoice.customer.name}</td>
              </tr>
              <tr>
                <td className="py-1 align-top font-semibold uppercase tracking-wide text-slate-400">Mobile</td>
                <td className="cell-wrap py-1 align-top text-slate-700">{invoice.customer.mobile}</td>
              </tr>
              <tr>
                <td className="py-1 align-top font-semibold uppercase tracking-wide text-slate-400">Address</td>
                <td className="cell-wrap py-1 align-top text-slate-700">{invoice.customer.address}</td>
              </tr>
              {invoice.customer.city && (
                <tr>
                  <td className="py-1 align-top font-semibold uppercase tracking-wide text-slate-400">City</td>
                  <td className="cell-wrap py-1 align-top text-slate-700">{invoice.customer.city}</td>
                </tr>
              )}
              {invoice.customer.state && (
                <tr>
                  <td className="py-1 align-top font-semibold uppercase tracking-wide text-slate-400">State</td>
                  <td className="cell-wrap py-1 align-top text-slate-700">{invoice.customer.state}</td>
                </tr>
              )}
              {invoice.customer.pincode && (
                <tr>
                  <td className="py-1 align-top font-semibold uppercase tracking-wide text-slate-400">Pincode</td>
                  <td className="cell-wrap py-1 align-top text-slate-700">{invoice.customer.pincode}</td>
                </tr>
              )}
              {invoice.customer.gstin && (
                <tr>
                  <td className="py-1 align-top font-semibold uppercase tracking-wide text-slate-400">GSTIN</td>
                  <td className="cell-wrap py-1 align-top text-slate-700">{invoice.customer.gstin}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <table className="mt-6 w-full max-w-full table-fixed border-collapse text-left text-sm">
          <thead className="border-y-2 border-slate-800 text-xs font-bold uppercase tracking-wide text-slate-900">
            <tr>
              <th className="w-[32%] px-2 py-1.5">Part Details</th>
              <th className="w-[9%] px-2 py-1.5 text-right">Qty</th>
              <th className="w-[11%] px-2 py-1.5 text-right">Discount</th>
              <th className="w-[13%] px-2 py-1.5 text-right">Price</th>
              <th className="w-[8%] px-2 py-1.5 text-right">Tax %</th>
              <th className="w-[11%] px-2 py-1.5 text-right">Tax Amt</th>
              <th className="w-[16%] px-2 py-1.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 border-b border-slate-300">
            {invoice.items.map((item) => {
              const disc = discountAmount(item);
              return (
                <tr key={item.id} className="print-avoid-break">
                  <td className="cell-wrap px-2 py-1.5">
                    <p className="font-semibold text-slate-900">{item.part.description}</p>
                    <p className="text-xs text-slate-500">{item.part.partNo}</p>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {item.quantity}/{item.part.unit}
                  </td>
                  <td className="px-2 py-1.5 text-right">{disc > 0 ? amt(disc) : "—"}</td>
                  <td className="px-2 py-1.5 text-right">{amt(item.sellingPrice)}</td>
                  <td className="px-2 py-1.5 text-right">{item.taxPercent}%</td>
                  <td className="px-2 py-1.5 text-right">{amt(item.taxAmount)}</td>
                  <td className="px-2 py-1.5 text-right font-medium">{amt(item.lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="print-avoid-break mt-4 flex justify-end">
          <div className="w-56 text-sm">
            <div className="flex justify-between py-1 text-slate-600">
              <span>Subtotal</span>
              <span>{amt(invoice.subtotal)}</span>
            </div>
            {gst.cgst > 0 || gst.sgst > 0 ? (
              <>
                <div className="flex justify-between py-1 text-slate-600">
                  <span>CGST</span>
                  <span>{amt(gst.cgst)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-600">
                  <span>SGST</span>
                  <span>{amt(gst.sgst)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between py-1 text-slate-600">
                <span>IGST</span>
                <span>{amt(gst.igst)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 py-2 text-base font-bold text-slate-900">
              <span>Grand Total</span>
              <span>{amt(invoice.grandTotal)}</span>
            </div>
          </div>
        </div>

        {invoice.status === "CANCELLED" && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            This invoice was cancelled{invoice.cancelledBy ? ` by ${invoice.cancelledBy.firstName} ${invoice.cancelledBy.lastName}` : ""}
            {invoice.cancellationReason ? `: ${invoice.cancellationReason}` : "."}
          </div>
        )}

        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Terms &amp; Conditions</p>
          <ol className="list-decimal space-y-0.5 pl-4 text-[9px] leading-snug text-slate-500">
            {INVOICE_TERMS.map((term, i) => (
              <li key={i}>{term}</li>
            ))}
          </ol>
        </div>

        <div className="print-avoid-break mt-6 flex items-end justify-between border-t border-slate-200 pt-6 text-sm">
          <p className="text-slate-500">Thank you for choosing us.</p>
          <div className="text-center">
            <div className="h-12 w-40 border-b border-slate-300" />
            <p className="mt-1 text-xs text-slate-400">Authorized Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}

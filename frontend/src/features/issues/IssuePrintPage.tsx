import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer, Download, Share2, Loader2, Boxes, MapPin, Phone, Mail } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import type { Issue } from "@/types";
import { Skeleton } from "@/components/ui/Feedback";
import { Badge } from "@/components/ui/Badge";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatDateTime } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/branding";
import { buildIssuePdfFile, saveIssuePdfToDevice, shareIssueFile, issueItemTotal, issueTotals, type HandoffResult } from "@/lib/issuePdf";
import { isNativePlatform } from "@/lib/platform";

const STATUS_TONE: Record<string, any> = {
  ISSUED: "info",
  PARTIALLY_RETURNED: "warning",
  FULLY_RETURNED: "success",
  CANCELLED: "danger",
};

/**
 * Same dual-view + native-handoff pattern as InvoicePrintPage: a screen
 * view of mobile-friendly cards, a print-only clean A4 layout, and Print/
 * Save/Share routed through the OS share sheet on native platforms since
 * Android's Capacitor WebView has no print engine and no working blob-URL
 * download — window.print() there is a guaranteed no-op, not a CSS bug.
 */
export function IssuePrintPage() {
  const { id } = useParams<{ id: string }>();
  const { push } = useToast();
  const [busy, setBusy] = useState<"print" | "save" | "share" | null>(null);

  const { data: issue, isLoading } = useQuery({
    queryKey: ["issue", id],
    queryFn: async () => (await apiClient.get<{ data: Issue }>(`/issues/${id}`)).data.data,
  });

  const dealerName = issue?.tenant?.name ?? PRODUCT_NAME;
  const dealerAddress = issue?.tenant?.address;
  const dealerPhone = issue?.tenant?.phone;
  const dealerEmail = issue?.tenant?.email;
  const issuedByName = issue?.createdBy ? `${issue.createdBy.firstName} ${issue.createdBy.lastName}` : undefined;

  function reportOutcome(result: HandoffResult, action: "printed" | "saved" | "shared") {
    if (result === "shared") {
      push({ tone: "success", title: "Choose where to save", description: 'Pick "Save to Files", "Drive", or a Print service from the menu that opened.' });
    } else if (result === "downloaded") {
      push({ tone: "success", title: action === "printed" ? "Print dialog opened" : "Issue slip PDF downloaded" });
    } else if (result === "unsupported") {
      push({
        tone: "info",
        title: "Not supported in this app",
        description: 'This action isn\'t available here. Please open this issue in a phone browser instead of the app, or try "Share".',
      });
    }
  }

  async function attemptPrint() {
    if (!issue) return;
    setBusy("print");
    try {
      if (isNativePlatform()) {
        const file = await buildIssuePdfFile(issue, dealerName, dealerAddress, dealerPhone, dealerEmail);
        reportOutcome(await shareIssueFile(file, `Issue ${issue.issueNumber}`), "printed");
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
    if (!issue) return;
    setBusy("save");
    try {
      const file = await buildIssuePdfFile(issue, dealerName, dealerAddress, dealerPhone, dealerEmail);
      reportOutcome(await saveIssuePdfToDevice(file), "saved");
    } catch {
      push({ tone: "error", title: "Unable to generate PDF", description: "Try again, or use Share instead." });
    } finally {
      setBusy(null);
    }
  }

  async function shareIssue() {
    if (!issue) return;
    setBusy("share");
    try {
      const file = await buildIssuePdfFile(issue, dealerName, dealerAddress, dealerPhone, dealerEmail);
      reportOutcome(await shareIssueFile(file, `Issue ${issue.issueNumber}`), "shared");
    } catch {
      push({ tone: "error", title: "Unable to share", description: "Try Save PDF instead." });
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || !issue) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-96 w-full" />
      </div>
    );
  }

  const totals = issueTotals(issue);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Action bar — screen only, never prints */}
      <div className="no-print mb-4 flex flex-wrap justify-end gap-2 px-4 pt-4 sm:px-0 sm:pt-0">
        <button
          onClick={shareIssue}
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
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600">
              <Boxes className="h-4 w-4 text-white" />
            </div>
            <p className="text-base font-extrabold tracking-tight text-slate-900">{PRODUCT_NAME}</p>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-700">{dealerName}</p>
          {dealerAddress && <p className="text-xs text-slate-500">{dealerAddress}</p>}
          {dealerPhone && <p className="text-xs text-slate-500">{dealerPhone}</p>}
          {dealerEmail && <p className="text-xs text-slate-500">{dealerEmail}</p>}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Issue Slip</p>
              <p className="text-lg font-bold text-slate-900">{issue.issueNumber}</p>
              <p className="mt-0.5 text-xs text-slate-500">Date: {formatDate(issue.issueDate)}</p>
              {issue.reference && <p className="text-xs text-slate-500">Reference: {issue.reference}</p>}
              {issuedByName && <p className="text-xs text-slate-500">Issued By: {issuedByName}</p>}
            </div>
            <Badge tone={STATUS_TONE[issue.status] ?? "neutral"}>{issue.status.replace("_", " ")}</Badge>
          </div>
        </div>

        <div className="space-y-2">
          {issue.items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <p className="text-sm font-semibold text-slate-900">{item.part.description}</p>
              <p className="text-xs text-slate-500">{item.part.partNo}</p>
              <CategoryBadge category={item.part.category} className="mt-1" />
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                <p>
                  Qty Issued: <span className="font-medium text-slate-800">{item.quantity} {item.part.unit}</span>
                </p>
                <p>
                  Qty Returned: <span className="font-medium text-slate-800">{item.returnedQty}</span>
                </p>
                <p>
                  MRP: <span className="font-medium text-slate-800">{Number(item.mrp).toLocaleString("en-IN")}</span>
                </p>
                <p>
                  Total: <span className="font-semibold text-slate-900">{issueItemTotal(item).toLocaleString("en-IN")}</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card text-sm">
          <div className="flex justify-between py-1 text-slate-600">
            <span>Total Items</span>
            <span className="font-medium text-slate-800">{totals.itemCount}</span>
          </div>
          <div className="flex justify-between py-1 text-slate-600">
            <span>Total Qty Issued</span>
            <span className="font-medium text-slate-800">{totals.qtyLabel}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-slate-900">
            <span>Total Value</span>
            <span>₹{totals.value.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {issue.remarks && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
            <p className="text-sm text-slate-700">{issue.remarks}</p>
          </div>
        )}
      </div>

      {/* ---------------- PRINT VIEW (clean A4 document layout) ---------------- */}
      <div className="print-only bg-white p-0 text-black">
        <div className="flex items-start justify-between gap-6 border-b-2 border-brand-500 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-600">
                <Boxes className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold uppercase tracking-tight text-navy-950">{PRODUCT_NAME}</p>
                <p className="text-sm font-semibold text-brand-700">{dealerName}</p>
              </div>
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-slate-500">
              {dealerAddress && (
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 shrink-0" /> {dealerAddress}
                </p>
              )}
              {dealerPhone && (
                <p className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 shrink-0" /> {dealerPhone}
                </p>
              )}
              {dealerEmail && (
                <p className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3 shrink-0" /> {dealerEmail}
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-xl font-extrabold uppercase tracking-tight text-navy-950">Issue Slip</p>
            <div className="mt-2 rounded-lg bg-brand-50 px-4 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">Issue No:</p>
              <p className="text-base font-bold text-brand-900">{issue.issueNumber}</p>
            </div>
            <div className="mt-2 space-y-0.5 text-xs">
              <p className="text-slate-600">
                Date: <span className="font-medium text-slate-800">{formatDate(issue.issueDate)}</span>
              </p>
              <p className="text-slate-600">
                Status: <Badge tone={STATUS_TONE[issue.status] ?? "neutral"}>{issue.status.replace("_", " ")}</Badge>
              </p>
              <p className="text-slate-600">
                Reference: <span className="font-medium text-slate-800">{issue.reference || "—"}</span>
              </p>
              {issuedByName && (
                <p className="text-slate-600">
                  Issued By: <span className="font-medium text-slate-800">{issuedByName}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <table className="mt-5 w-full max-w-full table-fixed border-collapse text-left text-sm">
          <thead className="border-y border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-[6%] py-2">S.No</th>
              <th className="w-[13%] py-2">Part No</th>
              <th className="w-[19%] py-2">Description</th>
              <th className="w-[12%] py-2">Category</th>
              <th className="w-[15%] py-2">Location</th>
              <th className="w-[10%] py-2 text-right">Qty Issued</th>
              <th className="w-[10%] py-2 text-right">Qty Returned</th>
              <th className="w-[8%] py-2 text-right">MRP (₹)</th>
              <th className="w-[9%] py-2 text-right">Total (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {issue.items.map((item, i) => (
              <tr key={item.id} className="print-avoid-break">
                <td className="py-2">{i + 1}</td>
                <td className="cell-wrap py-2">{item.part.partNo}</td>
                <td className="cell-wrap py-2">{item.part.description}</td>
                <td className="cell-wrap py-2">
                  <CategoryBadge category={item.part.category} />
                </td>
                <td className="cell-wrap py-2 text-xs text-slate-600">
                  {item.inventory.store.name} / {item.inventory.bin.code} / {item.inventory.rack.code}
                </td>
                <td className="py-2 text-right">{item.quantity} {item.part.unit}</td>
                <td className="py-2 text-right">{item.returnedQty}</td>
                <td className="py-2 text-right">{Number(item.mrp).toLocaleString("en-IN")}</td>
                <td className="py-2 text-right font-medium">{issueItemTotal(item).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="print-avoid-break mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <p>
            Total Items: <span className="font-bold text-slate-900">{totals.itemCount}</span>
          </p>
          <p>
            Total Qty Issued: <span className="font-bold text-slate-900">{totals.qtyLabel}</span>
          </p>
          <p>
            Total Value (₹): <span className="font-bold text-slate-900">{totals.value.toLocaleString("en-IN")}</span>
          </p>
        </div>

        <div className="print-avoid-break mt-4 rounded-lg border border-slate-200 p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes:</p>
          <p className="mt-1 text-slate-700">{issue.remarks || "—"}</p>
        </div>

        <div className="print-avoid-break mt-10 grid grid-cols-3 gap-6 text-center text-sm">
          <div>
            <div className="border-b border-dashed border-slate-400 pb-8" />
            <p className="mt-2 font-semibold text-slate-800">Issued By</p>
            {issuedByName && <p className="text-xs text-slate-500">{issuedByName}</p>}
          </div>
          <div>
            <div className="border-b border-dashed border-slate-400 pb-8" />
            <p className="mt-2 font-semibold text-slate-800">Received By</p>
            <p className="text-xs text-slate-500">(Name &amp; Signature)</p>
          </div>
          <div>
            <div className="border-b border-dashed border-slate-400 pb-8" />
            <p className="mt-2 font-semibold text-slate-800">Date</p>
          </div>
        </div>

        <div className="print-avoid-break mt-8 flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-400">
          <p>Generated from {PRODUCT_NAME}</p>
          <p>Print Date: {formatDateTime(new Date())}</p>
          <p className="text-right font-semibold text-brand-700">
            {dealerName}
            <br />
            <span className="text-[10px] uppercase tracking-wide">Thank You</span>
          </p>
        </div>
      </div>
    </div>
  );
}

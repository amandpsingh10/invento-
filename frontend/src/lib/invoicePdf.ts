import { jsPDF } from "jspdf";
import type { Invoice } from "@/types";
import { formatDate } from "@/lib/utils";

/** Plain "X,XXX.XX" with no currency prefix — matches the line-items table, which never carried one. */
function money(value: unknown): string {
  return Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * The invoice/invoice item schema has no "discount %" column of its own —
 * a discount is just whatever gap exists between the part's master MRP and
 * the sellingPrice actually billed (see SellPartPage's Discount % field,
 * which computes that gap forward into sellingPrice before the sale is
 * created). Re-deriving it here, from data every invoice already carries,
 * means the print/PDF views can show it without a migration or an API
 * change. Returns 0 (not negative) if sellingPrice was raised above MRP —
 * that's a markup, not a discount, and isn't shown as one.
 */
export function discountPercent(item: { sellingPrice: string | number; part: { mrp: string | number } }): number {
  const mrp = Number(item.part.mrp);
  const price = Number(item.sellingPrice);
  if (!(mrp > 0) || price >= mrp) return 0;
  return Math.round((1 - price / mrp) * 10000) / 100;
}

/** Same gap as discountPercent, expressed in ₹ per unit — matches the Discount (₹) field on Sell Part's web view, so the invoice shows the same figure the dealer actually typed rather than a re-derived percentage. */
export function discountAmount(item: { sellingPrice: string | number; part: { mrp: string | number } }): number {
  const mrp = Number(item.part.mrp);
  const price = Number(item.sellingPrice);
  if (!(mrp > 0) || price >= mrp) return 0;
  return Math.round((mrp - price) * 100) / 100;
}

/** Shared with the on-screen/print React view (InvoicePrintPage) so the wording only lives in one place. */
export const INVOICE_TERMS: string[] = [
  "Goods once sold are subject to the applicable return/replacement policy.",
  "Returns or replacements are accepted only against a valid invoice and as per the agreed return policy.",
  "Warranty, if applicable, will be subject to the manufacturer's warranty terms and conditions.",
  "Prices and taxes are charged as mentioned on the invoice.",
  "Any discrepancy in the invoice should be reported within 7 days of the invoice date.",
  "The customer is requested to verify the quantity and condition of the parts at the time of delivery.",
  "The invoice is considered accepted once the goods are received by the customer.",
  "All disputes are subject to the applicable jurisdiction.",
];

/**
 * Builds a proper, professionally-formatted A4 invoice PDF entirely
 * client-side (jsPDF draws real vector text/lines, not a screenshot) — no
 * backend PDF service and no native Capacitor plugin required, so it works
 * the same in a browser tab and inside the Android WebView. This is the
 * single source of truth for the generated invoice document; both the
 * "Save PDF" and "Share" actions build the file through this function.
 */
export function buildInvoicePdf(invoice: Invoice, dealerName: string, dealerAddress?: string | null): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 15;
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(dealerName, marginX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  y += 5;
  if (dealerAddress) {
    doc.text(dealerAddress, marginX, y);
    y += 5;
  }
  if (invoice.tenant?.gstin) {
    doc.text(`GSTIN: ${invoice.tenant.gstin}`, marginX, y);
    y += 5;
  }
  doc.setTextColor(0);

  y += 2;
  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7;

  // Label-value rows, two columns — mirrors the on-screen/print React
  // layout exactly (invoice meta on the left, customer details on the
  // right) rather than the previous free-floating text blocks. The
  // dealer's own GSTIN/state/pincode live once, in the header above —
  // repeating "State"/"Pincode" labels here (for the dealer) right next
  // to the customer's own State/Pincode read as duplicated fields.
  const leftRows: Array<[string, string]> = [
    ["Invoice No", invoice.invoiceNumber],
    ["Date", formatDate(invoice.invoiceDate)],
  ];

  const rightRows: Array<[string, string]> = [["Customer", invoice.customer.name], ["Mobile", invoice.customer.mobile]];
  if (invoice.customer.address) rightRows.push(["Address", invoice.customer.address]);
  if (invoice.customer.city) rightRows.push(["City", invoice.customer.city]);
  if (invoice.customer.state) rightRows.push(["State", invoice.customer.state]);
  if (invoice.customer.pincode) rightRows.push(["Pincode", invoice.customer.pincode]);
  if (invoice.customer.gstin) rightRows.push(["GSTIN", invoice.customer.gstin]);

  const rightColX = pageWidth / 2;
  const labelWidth = 20;
  const valueMaxWidth = pageWidth / 2 - marginX - labelWidth - 5;

  function drawMetaRows(rows: Array<[string, string]>, x: number, startY: number): number {
    let ry = startY;
    for (const [label, value] of rows) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(130);
      doc.text(label.toUpperCase(), x, ry);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30);
      const lines: string[] = doc.splitTextToSize(value, valueMaxWidth);
      doc.text(lines, x + labelWidth, ry);
      ry += Math.max(lines.length, 1) * 4.3;
    }
    return ry;
  }

  const leftEndY = drawMetaRows(leftRows, marginX, y);
  const rightEndY = drawMetaRows(rightRows, rightColX, y);
  doc.setTextColor(0);
  y = Math.max(leftEndY, rightEndY) + 4;

  // Line-items table — hand-drawn as a full bordered grid (no autotable
  // plugin needed for a handful of rows per invoice, keeps the dependency
  // footprint to one). Columns carry their own left/width so both the grid
  // lines and the text placement derive from the exact same layout — no
  // second, hand-maintained set of offsets to drift out of sync.
  type Col = { key: keyof RowValues; label: string; left: number; width: number; align: "left" | "right" };
  interface RowValues {
    partDetails: string;
    qtyUnit: string;
    disc: string;
    price: string;
    taxPct: string;
    taxAmt: string;
    total: string;
  }
  const tableWidth = pageWidth - marginX * 2;
  const colWidths = { partDetails: 0.32, qtyUnit: 0.09, disc: 0.11, price: 0.13, taxPct: 0.08, taxAmt: 0.11, total: 0.16 };
  const cols: Col[] = (() => {
    let left = marginX;
    const order: Array<{ key: keyof RowValues; label: string; align: "left" | "right" }> = [
      { key: "partDetails", label: "Part Details", align: "left" },
      { key: "qtyUnit", label: "Qty", align: "right" },
      { key: "disc", label: "Discount", align: "right" },
      { key: "price", label: "Price", align: "right" },
      { key: "taxPct", label: "Tax %", align: "right" },
      { key: "taxAmt", label: "Tax Amt", align: "right" },
      { key: "total", label: "Total", align: "right" },
    ];
    return order.map((c) => {
      const width = tableWidth * colWidths[c.key];
      const col = { ...c, left, width };
      left += width;
      return col;
    });
  })();
  const partDetailsCol = cols[0];

  const headerHeight = 7;
  // Taller than the other tables here — Part Details stacks two lines
  // (description, then Part No below it) in the same cell.
  const rowHeight = 10.5;
  const tableTop = y;
  const tableBottom = y + headerHeight + rowHeight * invoice.items.length;

  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  for (const col of cols) {
    const textX = col.align === "right" ? col.left + col.width - 1.5 : col.left + 1.5;
    doc.text(col.label.toUpperCase(), textX, y + 4.8, { align: col.align });
  }
  y += headerHeight;

  for (const item of invoice.items) {
    const disc = discountAmount(item);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const description =
      doc.splitTextToSize(item.part.description, partDetailsCol.width - 3)[0] ?? item.part.description;
    doc.text(description, partDetailsCol.left + 1.5, y + 4.3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100);
    const partNo = doc.splitTextToSize(item.part.partNo, partDetailsCol.width - 3)[0] ?? item.part.partNo;
    doc.text(partNo, partDetailsCol.left + 1.5, y + 8);
    doc.setTextColor(0);

    const values: RowValues = {
      partDetails: "",
      qtyUnit: `${item.quantity}/${item.part.unit}`,
      disc: disc > 0 ? disc.toLocaleString("en-IN") : "—",
      price: Number(item.sellingPrice).toLocaleString("en-IN"),
      taxPct: `${item.taxPercent}%`,
      taxAmt: Number(item.taxAmount).toLocaleString("en-IN"),
      total: Number(item.lineTotal).toLocaleString("en-IN"),
    };
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const col of cols) {
      if (col.key === "partDetails") continue;
      const textX = col.align === "right" ? col.left + col.width - 1.5 : col.left + 1.5;
      doc.text(values[col.key], textX, y + 6.2, { align: col.align });
    }
    y += rowHeight;
  }

  // Horizontal rules only — a line above and below the header, one between
  // each row, and a closing line under the last row. No vertical column
  // lines, matching a classic invoice table rather than a full grid.
  doc.setDrawColor(30);
  doc.setLineWidth(0.25);
  doc.line(marginX, tableTop, pageWidth - marginX, tableTop);
  doc.line(marginX, tableTop + headerHeight, pageWidth - marginX, tableTop + headerHeight);
  doc.setDrawColor(200);
  doc.setLineWidth(0.15);
  for (let i = 1; i < invoice.items.length; i++) {
    const rowY = tableTop + headerHeight + rowHeight * i;
    doc.line(marginX, rowY, pageWidth - marginX, rowY);
  }
  doc.setDrawColor(30);
  doc.setLineWidth(0.25);
  doc.line(marginX, tableBottom, pageWidth - marginX, tableBottom);
  doc.setLineWidth(0.2);

  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  for (const item of invoice.items) {
    cgstTotal += Number(item.cgstAmount);
    sgstTotal += Number(item.sgstAmount);
    igstTotal += Number(item.igstAmount);
  }

  y += 8;
  const totalsX = pageWidth - marginX - 55;
  doc.setFontSize(9.5);
  doc.setTextColor(90);
  doc.text("Subtotal", totalsX, y);
  doc.setTextColor(0);
  doc.text(money(invoice.subtotal), pageWidth - marginX, y, { align: "right" });
  y += 5.5;
  if (cgstTotal > 0 || sgstTotal > 0) {
    doc.setTextColor(90);
    doc.text("CGST", totalsX, y);
    doc.setTextColor(0);
    doc.text(money(cgstTotal), pageWidth - marginX, y, { align: "right" });
    y += 5.5;
    doc.setTextColor(90);
    doc.text("SGST", totalsX, y);
    doc.setTextColor(0);
    doc.text(money(sgstTotal), pageWidth - marginX, y, { align: "right" });
    y += 5.5;
  } else {
    doc.setTextColor(90);
    doc.text("IGST", totalsX, y);
    doc.setTextColor(0);
    doc.text(money(igstTotal), pageWidth - marginX, y, { align: "right" });
    y += 5.5;
  }
  y += 2;
  doc.setDrawColor(30);
  doc.line(totalsX, y, pageWidth - marginX, y);
  y += 5.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Grand Total", totalsX, y);
  doc.text(money(invoice.grandTotal), pageWidth - marginX, y, { align: "right" });

  if (invoice.status === "CANCELLED") {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(185, 28, 28);
    doc.text("THIS INVOICE HAS BEEN CANCELLED", marginX, y);
    doc.setTextColor(0);
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  const maxTextWidth = pageWidth - marginX * 2 - 4;

  // Rough upper-bound height check so terms don't get cut off mid-list —
  // real per-line wrapping is computed below via splitTextToSize.
  const estimatedTermsHeight = 6 + INVOICE_TERMS.length * 7;
  if (y + estimatedTermsHeight > pageHeight - 35) {
    doc.addPage();
    y = 18;
  }

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(90);
  doc.text("TERMS & CONDITIONS", marginX, y);
  y += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(110);
  for (let i = 0; i < INVOICE_TERMS.length; i++) {
    const lines: string[] = doc.splitTextToSize(`${i + 1}. ${INVOICE_TERMS[i]}`, maxTextWidth);
    doc.text(lines, marginX, y);
    y += lines.length * 3.4;
  }
  doc.setTextColor(0);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Thank you for choosing us.", marginX, y);
  doc.setDrawColor(180);
  doc.line(pageWidth - marginX - 45, y - 4, pageWidth - marginX, y - 4);
  doc.text("Authorized Signature", pageWidth - marginX - 45, y + 1);

  return doc;
}

/** Filename shared by both the "Save PDF" download and the Share attachment. */
export function invoicePdfFileName(invoice: Invoice): string {
  return `Invoice-${invoice.invoiceNumber}.pdf`;
}

export async function buildInvoicePdfFile(invoice: Invoice, dealerName: string, dealerAddress?: string | null): Promise<File> {
  const doc = buildInvoicePdf(invoice, dealerName, dealerAddress);
  const blob = doc.output("blob");
  return new File([blob], invoicePdfFileName(invoice), { type: "application/pdf" });
}

// Save/Share now live in nativeFile.ts, generalized to any file type (an
// Excel export needs the exact same native-vs-web handoff an invoice PDF
// does) — re-exported here under their original names so existing
// InvoicePrintPage.tsx/SellPartPage.tsx imports don't need to change.
export type { HandoffResult } from "@/lib/nativeFile";
export { saveFileToDevice as savePdfToDevice, shareFileToDevice as shareFile } from "@/lib/nativeFile";

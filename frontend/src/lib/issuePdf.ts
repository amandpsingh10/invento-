import { jsPDF } from "jspdf";
import type { Issue, IssueItem } from "@/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/branding";
import { PART_CATEGORY_LABELS, type PartCategoryCode } from "@/lib/partCategory";

export function issueItemTotal(item: Pick<IssueItem, "mrp" | "quantity">): number {
  return Number(item.mrp) * item.quantity;
}

/** Qty is only shown with a unit suffix when every line shares the same unit — a mixed-unit issue just shows the raw sum. */
export function issueTotals(issue: Issue) {
  const itemCount = issue.items.length;
  const value = issue.items.reduce((sum, item) => sum + issueItemTotal(item), 0);
  const totalQty = issue.items.reduce((sum, item) => sum + item.quantity, 0);
  const units = new Set(issue.items.map((item) => item.part.unit));
  const qtyLabel = units.size === 1 ? `${totalQty} ${issue.items[0]?.part.unit ?? ""}`.trim() : `${totalQty}`;
  return { itemCount, value, qtyLabel };
}

/**
 * Client-side Issue Slip PDF, built the same way as buildInvoicePdf
 * (invoicePdf.ts) — jsPDF draws real vector text/shapes, so it works
 * identically in a browser tab and inside the Android WebView, with no
 * backend PDF service or native Capacitor plugin required.
 */
export function buildIssuePdf(
  issue: Issue,
  dealerName: string,
  dealerAddress?: string | null,
  dealerPhone?: string | null,
  dealerEmail?: string | null
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 15;
  let y = 18;
  const headerTop = y;

  // Logo tile + product/dealer name (left column)
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(marginX, y - 5, 10, 10, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255);
  doc.text("IM", marginX + 5, y + 0.7, { align: "center" });
  doc.setTextColor(0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(PRODUCT_NAME.toUpperCase(), marginX + 13, y - 1.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(37, 99, 235);
  doc.text(dealerName, marginX + 13, y + 4);
  doc.setTextColor(0);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100);
  const contactLines = [dealerAddress, dealerPhone, dealerEmail].filter((v): v is string => !!v);
  for (const line of contactLines) {
    doc.text(line, marginX, y);
    y += 4.2;
  }
  doc.setTextColor(0);
  const leftEndY = y;

  // Issue Slip title + blue "Issue No" box + meta rows (right column)
  let ry = headerTop - 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text("ISSUE SLIP", pageWidth - marginX, ry, { align: "right" });
  doc.setTextColor(0);
  ry += 5;

  const boxWidth = 58;
  const boxX = pageWidth - marginX - boxWidth;
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(boxX, ry, boxWidth, 11, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(29, 78, 216);
  doc.text("ISSUE NO:", boxX + 3, ry + 4.2);
  doc.setFontSize(10.5);
  doc.text(issue.issueNumber, boxX + 3, ry + 8.8);
  doc.setTextColor(0);
  ry += 15;

  const metaRows: Array<[string, string]> = [["Date", formatDate(issue.issueDate)], ["Status", issue.status.replace(/_/g, " ")], ["Reference", issue.reference || "—"]];
  if (issue.createdBy) metaRows.push(["Issued By", `${issue.createdBy.firstName} ${issue.createdBy.lastName}`]);
  doc.setFontSize(8.5);
  for (const [label, value] of metaRows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`${label}:`, boxX, ry);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(value, pageWidth - marginX, ry, { align: "right" });
    ry += 4.5;
  }
  doc.setTextColor(0);

  y = Math.max(leftEndY, ry) + 4;
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageWidth - marginX, y);
  doc.setLineWidth(0.2);
  y += 8;

  // Line-items table — Part No and Description share one "Part Details"
  // column (two stacked lines, same as the invoice PDF's layout) instead
  // of two separate columns, and Qty/Unit are two columns instead of one
  // combined string. The old 9-column layout packed columns edge-to-edge
  // with barely any gap, which is exactly where long category/location
  // text would run into its neighbor — these widths/gaps are deliberately
  // more conservative.
  type Col = { key: keyof RowValues; label: string; x: number; align: "left" | "right"; width: number };
  interface RowValues {
    sno: string;
    description: string;
    partNo: string;
    category: string;
    location: string;
    qty: string;
    unit: string;
    returned: string;
    mrp: string;
    total: string;
  }
  const cols: Col[] = [
    { key: "sno", label: "S.No", x: marginX, align: "left", width: 7 },
    { key: "description", label: "Part Details", x: marginX + 8, align: "left", width: 38 },
    { key: "category", label: "Category", x: marginX + 48, align: "left", width: 22 },
    { key: "location", label: "Location", x: marginX + 72, align: "left", width: 26 },
    { key: "qty", label: "Qty Issued", x: marginX + 116, align: "right", width: 12 },
    { key: "unit", label: "Unit", x: marginX + 119, align: "left", width: 12 },
    { key: "returned", label: "Qty Ret.", x: marginX + 145, align: "right", width: 12 },
    { key: "mrp", label: "MRP", x: marginX + 163, align: "right", width: 16 },
    { key: "total", label: "Total", x: pageWidth - marginX, align: "right", width: 17 },
  ];

  const headerRowHeight = 7;
  doc.setFillColor(30, 41, 59);
  doc.rect(marginX, y, pageWidth - marginX * 2, headerRowHeight, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  for (const col of cols) {
    doc.text(col.label.toUpperCase(), col.align === "right" ? col.x : col.x + 1.5, y + 4.8, { align: col.align });
  }
  doc.setTextColor(0);
  y += headerRowHeight;

  doc.setFontSize(7.8);
  issue.items.forEach((item, i) => {
    // Taller than the header row — Part Details draws two stacked lines
    // (description, then part no) within it.
    const rowHeight = 9.5;
    doc.setDrawColor(230);
    doc.line(marginX, y + rowHeight, pageWidth - marginX, y + rowHeight);

    const partDetailsCol = cols.find((c) => c.key === "description")!;
    const descLine = doc.splitTextToSize(item.part.description, partDetailsCol.width)[0] ?? item.part.description;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(descLine, partDetailsCol.x + 1.5, y + 4.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(110);
    const partNoLine = doc.splitTextToSize(item.part.partNo, partDetailsCol.width)[0] ?? item.part.partNo;
    doc.text(partNoLine, partDetailsCol.x + 1.5, y + 7.8);
    doc.setFontSize(7.8);
    doc.setTextColor(0);

    const values: Omit<RowValues, "description" | "partNo"> = {
      sno: `${i + 1}`,
      category: PART_CATEGORY_LABELS[item.part.category as PartCategoryCode] ?? item.part.category,
      location: `${item.inventory.store.code}/${item.inventory.bin.code}/${item.inventory.rack.code}`,
      qty: `${item.quantity}`,
      unit: item.part.unit,
      returned: `${item.returnedQty}`,
      mrp: Number(item.mrp).toLocaleString("en-IN"),
      total: issueItemTotal(item).toLocaleString("en-IN"),
    };
    const rowY = y + 6.2;
    for (const col of cols) {
      if (col.key === "description") continue; // drawn above as the two-line block
      const value = values[col.key as keyof typeof values];
      const text: string = doc.splitTextToSize(value, col.width)[0] ?? value;
      doc.text(text, col.align === "right" ? col.x : col.x + 1.5, rowY, { align: col.align });
    }
    y += rowHeight;
  });

  y += 4;
  const totals = issueTotals(issue);
  doc.setFillColor(248, 250, 252);
  doc.rect(marginX, y, pageWidth - marginX * 2, 9, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(70);
  doc.text(`Total Items: `, marginX + 3, y + 5.8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${totals.itemCount}`, marginX + 22, y + 5.8);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(70);
  doc.text(`Total Qty Issued: `, pageWidth / 2 - 22, y + 5.8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(totals.qtyLabel, pageWidth / 2 + 10, y + 5.8);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(70);
  doc.text(`Total Value (Rs.): `, pageWidth - marginX - 45, y + 5.8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(totals.value.toLocaleString("en-IN"), pageWidth - marginX - 3, y + 5.8, { align: "right" });
  doc.setTextColor(0);
  y += 15;

  // Notes box
  doc.setDrawColor(220);
  const notesHeight = 14;
  doc.rect(marginX, y, pageWidth - marginX * 2, notesHeight);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(130);
  doc.text("NOTES:", marginX + 3, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30);
  doc.text(issue.remarks || "—", marginX + 3, y + 10.5);
  doc.setTextColor(0);
  y += notesHeight + 14;

  // Signature blocks
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + 20 > pageHeight - 20) {
    doc.addPage();
    y = 20;
  }
  const sigWidth = (pageWidth - marginX * 2) / 3;
  const issuedByName = issue.createdBy ? `${issue.createdBy.firstName} ${issue.createdBy.lastName}` : "";
  const sigLabels: Array<[string, string]> = [
    ["Issued By", issuedByName],
    ["Received By", "(Name & Signature)"],
    ["Date", ""],
  ];
  doc.setDrawColor(150);
  sigLabels.forEach(([label, sub], i) => {
    const cx = marginX + sigWidth * i;
    doc.line(cx, y, cx + sigWidth - 10, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30);
    doc.text(label, cx, y + 5);
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(120);
      doc.text(sub, cx, y + 9);
    }
    doc.setTextColor(0);
  });
  y += 20;

  // Footer
  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(150);
  doc.text(`Generated from ${PRODUCT_NAME}`, marginX, y);
  doc.text(`Print Date: ${formatDateTime(new Date())}`, pageWidth / 2, y, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text(dealerName, pageWidth - marginX, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("THANK YOU", pageWidth - marginX, y + 3.5, { align: "right" });
  doc.setTextColor(0);

  return doc;
}

export function issuePdfFileName(issue: Issue): string {
  return `Issue-${issue.issueNumber}.pdf`;
}

export async function buildIssuePdfFile(
  issue: Issue,
  dealerName: string,
  dealerAddress?: string | null,
  dealerPhone?: string | null,
  dealerEmail?: string | null
): Promise<File> {
  const doc = buildIssuePdf(issue, dealerName, dealerAddress, dealerPhone, dealerEmail);
  const blob = doc.output("blob");
  return new File([blob], issuePdfFileName(issue), { type: "application/pdf" });
}

export type { HandoffResult } from "@/lib/nativeFile";
export { saveFileToDevice as saveIssuePdfToDevice, shareFileToDevice as shareIssueFile } from "@/lib/nativeFile";

import ExcelJS from "exceljs";
import { env } from "../../config/env";
import { PART_UNITS } from "../../utils/quantity";
import { cellToString, cellToNumber } from "../../utils/excelCell";

export const TEMPLATE_HEADERS = [
  "Invoice No",
  "Part No",
  "Part Description",
  "Tax %",
  "HSN Code",
  "MRP",
  "NDP (Without Tax)",
  "Unit",
  "Quantity",
  "Store",
  "Bin",
  "Rack",
] as const;

export interface ParsedPurchaseRow {
  rowNumber: number;
  invoiceNo: string;
  partNo: string;
  partDescription: string;
  taxPercent: number | null;
  hsnCode: string;
  mrp: number | null;
  ndp: number | null;
  /**
   * Set only by the manual-entry path, which prices NDP-first (NDP + this
   * margin → List Price, + tax → MRP; see utils/pricing.ts) — there, ndp is
   * authoritative and mrp is already derived from it. Left undefined by the
   * Excel path, which stays MRP-first (NDP back-derived, margin stored as 0).
   */
  dealerMarginPercent?: number;
  // NOS | LTR | ML | KGS — empty/unrecognized defaults to NOS in validation
  // (see purchases.validation.ts), never silently rejected.
  unit: string;
  quantity: number | null;
  storeCode: string;
  binCode: string;
  rackCode: string;
}

export interface ValidatedPurchaseRow extends ParsedPurchaseRow {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  /** True when an uploaded/entered NDP didn't match the MRP/Tax%-derived value — the calculated value is always what gets stored (see calculateNDP). */
  ndpMismatch: boolean;
}

/** Generates the downloadable purchase-upload Excel template with a sample row. */
export async function buildPurchaseTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Purchase Upload");

  sheet.columns = TEMPLATE_HEADERS.map((header) => ({ header, key: header, width: 20 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  sheet.addRow({
    "Invoice No": "INV-10001",
    "Part No": "BRK-PAD-001",
    "Part Description": "Front Brake Pad",
    "Tax %": 28,
    "HSN Code": "87083000",
    MRP: 5000,
    "NDP (Without Tax)": 3500,
    Unit: "NOS",
    Quantity: 10,
    Store: "Main Store",
    Bin: "BIN-01",
    Rack: "RACK-03",
  });

  // Dropdown so Unit is always one of the four supported values, never a
  // free-text typo that would silently fall back to NOS in validation.
  // ExcelJS has no bulk range-validation API — set per-cell instead.
  const unitColLetter = sheet.getColumn("Unit").letter;
  for (let row = 2; row <= 1000; row++) {
    sheet.getCell(`${unitColLetter}${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${PART_UNITS.join(",")}"`],
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Parses an uploaded Excel workbook into raw rows. Formulas are read as
 * their last-computed result only (never executed) — ExcelJS does not
 * evaluate macros/formulas, it just reads cached values, which is what we
 * want for untrusted input.
 */
export async function parsePurchaseExcel(buffer: Buffer, maxRows: number): Promise<ParsedPurchaseRow[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs ships its own slightly stale Buffer typing that doesn't line up
  // with @types/node 20's Buffer<ArrayBufferLike> — safe to cast, the
  // runtime value is a plain Node Buffer either way.
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The uploaded file has no worksheet");

  const headerRow = sheet.getRow(1);
  const headerMap = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    headerMap.set(cellToString(cell.value).toLowerCase(), colNumber);
  });

  const col = (name: string) => headerMap.get(name.toLowerCase());
  const colInvoice = col("Invoice No");
  const colPartNo = col("Part No");
  const colDesc = col("Part Description");
  const colTax = col("Tax %");
  const colHsn = col("HSN Code");
  const colMrp = col("MRP");
  const colNdp = col("NDP (Without Tax)");
  const colUnit = col("Unit");
  const colQty = col("Quantity");
  const colStore = col("Store");
  const colBin = col("Bin");
  const colRack = col("Rack");

  // "Unit" is optional (defaults to NOS — see validatePurchaseRows) so an
  // older sheet exported before this column existed still uploads fine.
  const missingHeaders = TEMPLATE_HEADERS.filter((h) => h !== "Unit" && !headerMap.has(h.toLowerCase()));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required column(s): ${missingHeaders.join(", ")}`);
  }

  const rows: ParsedPurchaseRow[] = [];
  const totalDataRows = sheet.rowCount - 1;
  if (totalDataRows > maxRows) {
    throw new Error(`File has ${totalDataRows} rows, which exceeds the maximum of ${maxRows} rows per upload`);
  }

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (row.actualCellCount === 0 || row.values === undefined || (Array.isArray(row.values) && row.values.every((v) => v === null || v === undefined || v === ""))) {
      continue; // skip fully blank rows
    }

    rows.push({
      rowNumber,
      invoiceNo: cellToString(row.getCell(colInvoice!).value),
      partNo: cellToString(row.getCell(colPartNo!).value),
      partDescription: cellToString(row.getCell(colDesc!).value),
      taxPercent: cellToNumber(row.getCell(colTax!).value),
      hsnCode: cellToString(row.getCell(colHsn!).value),
      mrp: cellToNumber(row.getCell(colMrp!).value),
      ndp: cellToNumber(row.getCell(colNdp!).value),
      unit: colUnit ? cellToString(row.getCell(colUnit).value).toUpperCase() : "",
      quantity: cellToNumber(row.getCell(colQty!).value),
      storeCode: cellToString(row.getCell(colStore!).value),
      binCode: cellToString(row.getCell(colBin!).value),
      rackCode: cellToString(row.getCell(colRack!).value),
    });
  }

  return rows;
}

/** Builds a downloadable Excel of only the invalid rows, with an Error column, for correction & re-upload. */
export async function buildErrorReportExcel(rows: ValidatedPurchaseRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Rejected Rows");
  sheet.columns = [...TEMPLATE_HEADERS, "Error"].map((header) => ({ header, key: header, width: 22 }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDC2626" } };

  for (const row of rows.filter((r) => !r.isValid)) {
    sheet.addRow({
      "Invoice No": row.invoiceNo,
      "Part No": row.partNo,
      "Part Description": row.partDescription,
      "Tax %": row.taxPercent,
      "HSN Code": row.hsnCode,
      MRP: row.mrp,
      "NDP (Without Tax)": row.ndp,
      Unit: row.unit,
      Quantity: row.quantity,
      Store: row.storeCode,
      Bin: row.binCode,
      Rack: row.rackCode,
      Error: row.errors.join("; "),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export const MAX_EXCEL_ROWS = env.MAX_EXCEL_ROWS;

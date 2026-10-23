import ExcelJS from "exceljs";
import { env } from "../../config/env";
import { cellToString, cellToNumber } from "../../utils/excelCell";
import { PART_UNITS } from "../../utils/quantity";
import { PART_CATEGORIES } from "../../utils/partCategory";

export const MAX_EXCEL_ROWS = env.MAX_EXCEL_ROWS;

export const PARTS_TEMPLATE_HEADERS = [
  "Part No",
  "Part Description",
  "Tax %",
  "HSN Code",
  "MRP",
  "NDP (Without Tax)",
  "Unit",
  "Category",
  "Barcode",
  "Minimum Stock Level",
  "Status",
] as const;

export interface ParsedPartRow {
  rowNumber: number;
  partNo: string;
  partDescription: string;
  taxPercent: number | null;
  hsnCode: string;
  mrp: number | null;
  ndp: number | null;
  unit: string;
  category: string;
  barcode: string;
  minimumStockLevel: number | null;
  status: string;
}

export interface ValidatedPartRow extends Omit<ParsedPartRow, "minimumStockLevel"> {
  // Resolved to a concrete whole number (defaulting to 0) during
  // validation — never null past that point, unlike the raw parsed value.
  minimumStockLevel: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  /** True when an uploaded NDP didn't match the MRP/Tax%-derived value — the calculated value is always what gets stored (see calculateNDP). */
  ndpMismatch: boolean;
}

/** Generates the downloadable Parts bulk-upload Excel template with a sample row — pure master data, no store/bin/rack/quantity. */
export async function buildPartsTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Parts Upload");

  sheet.columns = PARTS_TEMPLATE_HEADERS.map((header) => ({ header, key: header, width: 20 }));
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  sheet.addRow({
    "Part No": "BRK-PAD-001",
    "Part Description": "Front Brake Pad",
    "Tax %": 28,
    "HSN Code": "87083000",
    MRP: 5000,
    "NDP (Without Tax)": 3500,
    Unit: "NOS",
    Category: "P",
    Barcode: "",
    "Minimum Stock Level": 5,
    Status: "ACTIVE",
  });

  // Dropdowns so Unit/Category/Status are always one of the recognized
  // values, never a free-text typo silently falling back to a default in
  // validation. ExcelJS has no bulk range-validation API — set per-cell.
  const unitColLetter = sheet.getColumn("Unit").letter;
  const categoryColLetter = sheet.getColumn("Category").letter;
  const statusColLetter = sheet.getColumn("Status").letter;
  for (let row = 2; row <= 1000; row++) {
    sheet.getCell(`${unitColLetter}${row}`).dataValidation = { type: "list", allowBlank: true, formulae: [`"${PART_UNITS.join(",")}"`] };
    sheet.getCell(`${categoryColLetter}${row}`).dataValidation = { type: "list", allowBlank: true, formulae: [`"${PART_CATEGORIES.join(",")}"`] };
    sheet.getCell(`${statusColLetter}${row}`).dataValidation = { type: "list", allowBlank: true, formulae: [`"ACTIVE,INACTIVE"`] };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Parses an uploaded Parts Excel workbook into raw rows. Formulas are read
 * as their last-computed result only (never executed) — ExcelJS does not
 * evaluate macros/formulas, it just reads cached values, which is what we
 * want for untrusted input.
 */
export async function parsePartsExcel(buffer: Buffer, maxRows: number): Promise<ParsedPartRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The uploaded file has no worksheet");

  const headerRow = sheet.getRow(1);
  const headerMap = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    headerMap.set(cellToString(cell.value).toLowerCase(), colNumber);
  });

  const col = (name: string) => headerMap.get(name.toLowerCase());
  const colPartNo = col("Part No");
  const colDesc = col("Part Description");
  const colTax = col("Tax %");
  const colHsn = col("HSN Code");
  const colMrp = col("MRP");
  const colNdp = col("NDP (Without Tax)");
  const colUnit = col("Unit");
  const colCategory = col("Category");
  const colBarcode = col("Barcode");
  const colMinStock = col("Minimum Stock Level");
  const colStatus = col("Status");

  // Unit/Category/Barcode/Minimum Stock Level/Status are all optional
  // (they default sensibly in validation) so an older/simpler sheet still
  // uploads fine — only Part No/Description/Tax %/HSN/MRP are mandatory.
  const requiredHeaders = ["Part No", "Part Description", "Tax %", "HSN Code", "MRP"];
  const missingHeaders = requiredHeaders.filter((h) => !headerMap.has(h.toLowerCase()));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required column(s): ${missingHeaders.join(", ")}`);
  }

  const rows: ParsedPartRow[] = [];
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
      partNo: cellToString(row.getCell(colPartNo!).value),
      partDescription: cellToString(row.getCell(colDesc!).value),
      taxPercent: cellToNumber(row.getCell(colTax!).value),
      hsnCode: cellToString(row.getCell(colHsn!).value),
      mrp: cellToNumber(row.getCell(colMrp!).value),
      ndp: colNdp ? cellToNumber(row.getCell(colNdp).value) : null,
      unit: colUnit ? cellToString(row.getCell(colUnit).value).toUpperCase() : "",
      category: colCategory ? cellToString(row.getCell(colCategory).value).toUpperCase() : "",
      barcode: colBarcode ? cellToString(row.getCell(colBarcode).value) : "",
      minimumStockLevel: colMinStock ? cellToNumber(row.getCell(colMinStock).value) : null,
      status: colStatus ? cellToString(row.getCell(colStatus).value).toUpperCase() : "",
    });
  }

  return rows;
}

/** Builds a downloadable Excel of only the invalid rows, with an Error column, for correction & re-upload. */
export async function buildPartsErrorReportExcel(rows: ValidatedPartRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Rejected Rows");
  sheet.columns = [...PARTS_TEMPLATE_HEADERS, "Error"].map((header) => ({ header, key: header, width: 24 }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDC2626" } };

  for (const row of rows.filter((r) => !r.isValid)) {
    sheet.addRow({
      "Part No": row.partNo,
      "Part Description": row.partDescription,
      "Tax %": row.taxPercent,
      "HSN Code": row.hsnCode,
      MRP: row.mrp,
      "NDP (Without Tax)": row.ndp,
      Unit: row.unit,
      Category: row.category,
      Barcode: row.barcode,
      "Minimum Stock Level": row.minimumStockLevel,
      Status: row.status,
      Error: row.errors.join("; "),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

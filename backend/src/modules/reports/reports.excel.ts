import ExcelJS from "exceljs";

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export async function exportToExcel(sheetName: string, columns: ExportColumn[], rows: Record<string, unknown>[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  for (const row of rows) sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

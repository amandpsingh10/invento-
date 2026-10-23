import type ExcelJS from "exceljs";

export function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in (value as any)) return String((value as any).text ?? "").trim();
  if (typeof value === "object" && "result" in (value as any)) return String((value as any).result ?? "").trim();
  return String(value).trim();
}

export function cellToNumber(value: ExcelJS.CellValue): number | null {
  const str = cellToString(value);
  if (str === "") return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

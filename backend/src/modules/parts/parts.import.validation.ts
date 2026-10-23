import { resolveUnit } from "../../utils/quantity";
import { isValidPartCategory, type PartCategory } from "../../utils/partCategory";
import { resolveNdp } from "../purchases/purchases.validation";
import type { ParsedPartRow, ValidatedPartRow } from "./parts.excel";

const VALID_STATUSES = new Set(["ACTIVE", "INACTIVE"]);

/**
 * Pure field-level validation (no DB access), mirroring
 * purchases.validation.ts's validateRowFields but for parts-only master
 * data — no store/bin/rack/quantity involved here at all.
 */
export function validatePartRowFields(row: ParsedPartRow): string[] {
  const errors: string[] = [];

  if (!row.partNo) errors.push("Part No missing");
  if (!row.partDescription) errors.push("Part Description missing");

  if (row.taxPercent === null) errors.push("Tax % must be numeric");
  else if (row.taxPercent < 0 || row.taxPercent > 100) errors.push("Tax % must be between 0 and 100");

  if (!row.hsnCode) errors.push("HSN Code missing");

  if (row.mrp === null) errors.push("MRP must be numeric");
  else if (row.mrp < 0) errors.push("MRP cannot be negative");

  // NDP is never a required input — always reverse-calculated from MRP and
  // Tax% (see resolveNdp, shared with the purchase-upload path). A
  // supplied value is only checked against the calculated one.
  if (row.ndp !== null && row.ndp < 0) errors.push("NDP cannot be negative");

  if (resolveUnit(row.unit) === null) errors.push(`Unit "${row.unit}" is not recognized — use NOS, LTR, ML or KGS`);

  if (row.category && !isValidPartCategory(row.category)) {
    errors.push(`Category "${row.category}" is not recognized — use O, C, A or P`);
  }

  if (row.minimumStockLevel !== null && (row.minimumStockLevel < 0 || !Number.isInteger(row.minimumStockLevel))) {
    errors.push("Minimum Stock Level must be a whole number, 0 or greater");
  }

  if (row.status && !VALID_STATUSES.has(row.status)) {
    errors.push(`Status "${row.status}" is not recognized — use ACTIVE or INACTIVE`);
  }

  return errors;
}

/**
 * Validates parsed rows against the field rules above, plus a within-file
 * duplicate-Part-No check — two rows for the same Part No would silently
 * have the second one win the upsert with no indication, so that's
 * flagged as an error on every row sharing the number rather than allowed
 * through.
 */
export function validatePartRows(rows: ParsedPartRow[]): ValidatedPartRow[] {
  const partNoCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.partNo) continue;
    const key = row.partNo.toLowerCase();
    partNoCounts.set(key, (partNoCounts.get(key) ?? 0) + 1);
  }

  return rows.map((row): ValidatedPartRow => {
    const errors = validatePartRowFields(row);

    if (row.partNo && (partNoCounts.get(row.partNo.toLowerCase()) ?? 0) > 1) {
      errors.push(`Part No "${row.partNo}" appears more than once in this file`);
    }

    const unit = resolveUnit(row.unit) ?? "NOS";
    const category: PartCategory = row.category && isValidPartCategory(row.category) ? (row.category.toUpperCase() as PartCategory) : "P";
    const status = row.status && VALID_STATUSES.has(row.status) ? row.status : "ACTIVE";
    const minimumStockLevel = row.minimumStockLevel ?? 0;

    const { ndp, ndpMismatch, warnings } = resolveNdp(row.mrp, row.taxPercent, row.ndp);

    return { ...row, ndp, unit, category, status, minimumStockLevel, isValid: errors.length === 0, errors, warnings, ndpMismatch };
  });
}

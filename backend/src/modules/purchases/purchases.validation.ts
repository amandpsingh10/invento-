import { prisma } from "../../lib/prisma";
import { calculateNDP } from "../../utils/pricing";
import { resolveUnit, isValidQuantityForUnit } from "../../utils/quantity";
import type { ParsedPurchaseRow, ValidatedPurchaseRow } from "./purchases.excel";

/**
 * Pure field-level validation (no DB access) — the numeric/mandatory-field
 * rules from spec section 13. Exported separately so it can be unit tested
 * without a database.
 */
export function validateRowFields(row: ParsedPurchaseRow): string[] {
  const errors: string[] = [];

  if (!row.invoiceNo) errors.push("Invoice No missing");
  if (!row.partNo) errors.push("Part No missing");
  if (!row.partDescription) errors.push("Part Description missing");

  if (row.taxPercent === null) errors.push("Tax % must be numeric");
  else if (row.taxPercent < 0 || row.taxPercent > 100) errors.push("Tax % must be between 0 and 100");

  if (!row.hsnCode) errors.push("HSN Code missing");

  if (row.mrp === null) errors.push("MRP must be numeric");
  else if (row.mrp < 0) errors.push("MRP cannot be negative");

  // Excel rows are MRP-first: NDP is never a required input, it's
  // reverse-calculated from MRP and Tax% (see calculateNDP), and a supplied
  // value is only checked against the calculated one. Manual-entry rows
  // (dealerMarginPercent set) are NDP-first: NDP is the entered value, and
  // MRP was already derived from it before validation.
  if (row.ndp !== null && row.ndp < 0) errors.push("NDP cannot be negative");
  if (row.dealerMarginPercent !== undefined) {
    if (row.ndp === null) errors.push("NDP must be numeric");
    if (row.dealerMarginPercent < 0 || row.dealerMarginPercent > 500) errors.push("Dealer margin % must be between 0 and 500");
  }

  const unit = resolveUnit(row.unit);
  if (unit === null) errors.push(`Unit "${row.unit}" is not recognized — use NOS, LTR, ML or KGS`);

  if (row.quantity === null) errors.push("Quantity must be numeric");
  else if (row.quantity <= 0) errors.push("Quantity must be greater than 0");
  else if (unit !== null && !isValidQuantityForUnit(row.quantity, unit)) {
    errors.push(`Quantity must be a whole number for parts measured in ${unit} (only ML, LTR and KGS allow decimal quantities)`);
  }

  if (!row.storeCode) errors.push("Store is mandatory");
  if (!row.binCode) errors.push("Bin is mandatory");
  if (!row.rackCode) errors.push("Rack is mandatory");

  return errors;
}

/**
 * Resolves the authoritative NDP for a row: whenever MRP and Tax% are
 * present and in range, NDP is always the calculated value — never the
 * uploaded/entered one. A supplied value that disagrees with the
 * calculated one (beyond rounding noise) is flagged via ndpMismatch/a
 * warning message, but never blocks import. Pure and DB-free so it's
 * independently unit-testable.
 */
export function resolveNdp(
  mrp: number | null,
  taxPercent: number | null,
  suppliedNdp: number | null
): { ndp: number | null; ndpMismatch: boolean; warnings: string[] } {
  if (mrp === null || taxPercent === null || taxPercent < 0 || taxPercent > 100) {
    return { ndp: suppliedNdp, ndpMismatch: false, warnings: [] };
  }

  const calculatedNdp = calculateNDP(mrp, taxPercent);
  if (suppliedNdp !== null && Math.abs(suppliedNdp - calculatedNdp) > 0.01) {
    return {
      ndp: calculatedNdp,
      ndpMismatch: true,
      warnings: [
        `NDP does not match the calculated value. Uploaded: ₹${suppliedNdp.toFixed(2)}, using calculated: ₹${calculatedNdp.toFixed(2)}.`,
      ],
    };
  }

  return { ndp: calculatedNdp, ndpMismatch: false, warnings: [] };
}

/**
 * Validates parsed Excel rows against both static field rules and the
 * tenant's master data (Store/Bin/Rack must already exist). Runs entirely
 * server-side against data scoped to the caller's tenantId.
 */
export async function validatePurchaseRows(tenantId: string, rows: ParsedPurchaseRow[]): Promise<ValidatedPurchaseRow[]> {
  const [stores, bins, racks] = await Promise.all([
    prisma.store.findMany({ where: { tenantId }, select: { id: true, code: true, name: true, status: true } }),
    prisma.bin.findMany({ where: { tenantId }, select: { id: true, code: true, storeId: true, status: true } }),
    prisma.rack.findMany({ where: { tenantId }, select: { id: true, code: true, storeId: true, status: true } }),
  ]);

  const storeByCode = new Map(stores.map((s) => [s.code.toLowerCase(), s]));
  const storeByName = new Map(stores.map((s) => [s.name.toLowerCase(), s]));

  return rows.map((row): ValidatedPurchaseRow => {
    const errors = validateRowFields(row);

    if (row.storeCode) {
      const store = storeByCode.get(row.storeCode.toLowerCase()) ?? storeByName.get(row.storeCode.toLowerCase());
      if (!store) {
        errors.push(`Store "${row.storeCode}" not found`);
      } else if (store.status === "INACTIVE") {
        errors.push(`Store "${row.storeCode}" is inactive`);
      } else {
        if (row.binCode) {
          const bin = bins.find((b) => b.storeId === store.id && b.code.toLowerCase() === row.binCode.toLowerCase());
          if (!bin) errors.push(`Bin "${row.binCode}" not found in store "${row.storeCode}"`);
          else if (bin.status === "INACTIVE") errors.push(`Bin "${row.binCode}" is inactive`);
        }
        if (row.rackCode) {
          const rack = racks.find((r) => r.storeId === store.id && r.code.toLowerCase() === row.rackCode.toLowerCase());
          if (!rack) errors.push(`Rack "${row.rackCode}" not found in store "${row.storeCode}"`);
          else if (rack.status === "INACTIVE") errors.push(`Rack "${row.rackCode}" is inactive`);
        }
      }
    }

    // NDP-first rows keep the entered NDP as-is; running resolveNdp on them
    // would "correct" it to MRP ÷ (1 + tax) and drop the dealer margin.
    const { ndp, ndpMismatch, warnings } =
      row.dealerMarginPercent !== undefined
        ? { ndp: row.ndp, ndpMismatch: false, warnings: [] as string[] }
        : resolveNdp(row.mrp, row.taxPercent, row.ndp);
    // Resolved unit overrides the raw parsed value the same way ndp does —
    // downstream import code trusts this field directly rather than
    // re-deriving it. Falls back to NOS if unrecognized (isValid is
    // already false in that case from the error pushed above).
    const unit = resolveUnit(row.unit) ?? "NOS";

    return { ...row, ndp, unit, isValid: errors.length === 0, errors, warnings, ndpMismatch };
  });
}

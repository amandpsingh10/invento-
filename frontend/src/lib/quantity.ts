import type { PartUnit } from "@/types";

export const PART_UNITS: PartUnit[] = ["NOS", "LTR", "ML", "KGS"];

/** Mirrors backend/src/utils/quantity.ts exactly — ML, LTR and KGS allow fractional quantities; NOS stays whole-unit only. */
export function unitAllowsDecimalQuantity(unit: PartUnit | string | null | undefined): boolean {
  const u = (unit ?? "NOS").toUpperCase();
  return u === "ML" || u === "LTR" || u === "KGS";
}

export function isValidQuantityForUnit(quantity: number, unit: PartUnit | string | null | undefined): boolean {
  if (!Number.isFinite(quantity)) return false;
  if (Number.isInteger(quantity)) return true;
  return unitAllowsDecimalQuantity(unit);
}

/** Rounds to a valid quantity for the given unit — whole numbers for NOS, up to 3 decimals for ML/LTR/KGS. */
export function normalizeQuantityForUnit(quantity: number, unit: PartUnit | string | null | undefined): number {
  if (!Number.isFinite(quantity)) return 0;
  if (!unitAllowsDecimalQuantity(unit)) return Math.round(quantity);
  return Math.round(quantity * 1000) / 1000;
}

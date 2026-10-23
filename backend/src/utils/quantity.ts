export const PART_UNITS = ["NOS", "LTR", "ML", "KGS"] as const;
export type PartUnit = (typeof PART_UNITS)[number];

/**
 * Units whose quantities may carry a fraction (e.g. 0.250 KGS of grease,
 * 500 ML of coolant, 2.5 LTR of engine oil). NOS (whole numbers/count)
 * stays whole-unit only — this is a business rule requested explicitly,
 * not a data-type limitation (every quantity column is Decimal(12,3)
 * regardless, so enforcement always happens here, never at the schema
 * level).
 */
const DECIMAL_UNITS: ReadonlySet<string> = new Set(["ML", "LTR", "KGS"]);

export function unitAllowsDecimalQuantity(unit: string | null | undefined): boolean {
  return DECIMAL_UNITS.has((unit ?? "NOS").toUpperCase());
}

export function isValidPartUnit(unit: string): unit is PartUnit {
  return (PART_UNITS as readonly string[]).includes(unit.toUpperCase());
}

/** Blank/whitespace-only defaults to NOS (matches the existing "no unit column" behavior); anything else must be one of the four recognized values. */
export function resolveUnit(rawUnit: string | null | undefined): PartUnit | null {
  const trimmed = (rawUnit ?? "").trim().toUpperCase();
  if (trimmed === "") return "NOS";
  return isValidPartUnit(trimmed) ? trimmed : null;
}

/** True if `quantity` is an allowed value for a part measured in `unit` — whole numbers always allowed, fractions only for ML/LTR/KGS. */
export function isValidQuantityForUnit(quantity: number, unit: string | null | undefined): boolean {
  if (!Number.isFinite(quantity)) return false;
  if (Number.isInteger(quantity)) return true;
  return unitAllowsDecimalQuantity(unit);
}

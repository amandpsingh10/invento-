const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * NDP + dealer margin % — mirrors backend/src/utils/pricing.ts exactly.
 * Display-only: the backend always recomputes and is the authoritative source
 * of truth, so these are never sent to the API as the actual MRP.
 */
export function calculateListPrice(ndp: number, dealerMarginPercent: number): number {
  return round2(ndp * (1 + dealerMarginPercent / 100));
}

/** List Price + tax %. The List Price is rounded first so NDP → List Price → MRP adds up exactly as shown. */
export function calculateMRP(ndp: number, dealerMarginPercent: number, taxPercent: number): number {
  return round2(calculateListPrice(ndp, dealerMarginPercent) * (1 + taxPercent / 100));
}

/**
 * Turns the form's string inputs into the List Price / MRP preview, or nulls
 * while NDP or Tax % is still blank/invalid. A blank margin counts as 0%.
 */
export function previewPricing(ndp: string, dealerMarginPercent: string, taxPercent: string): { listPrice: number; mrp: number } | null {
  if (ndp.trim() === "" || taxPercent.trim() === "") return null;
  const ndpNum = Number(ndp);
  const taxNum = Number(taxPercent);
  const marginNum = dealerMarginPercent.trim() === "" ? 0 : Number(dealerMarginPercent);
  if (![ndpNum, taxNum, marginNum].every(Number.isFinite)) return null;
  return { listPrice: calculateListPrice(ndpNum, marginNum), mrp: calculateMRP(ndpNum, marginNum, taxNum) };
}

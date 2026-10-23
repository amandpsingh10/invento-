const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Part pricing chain, entered as NDP:
 *   List Price = NDP + Dealer Margin %
 *   MRP        = List Price + Tax %
 * This is the single source of truth for MRP — the Part master form and the
 * Add Inventory (manual entry) form both funnel through calculateMRP rather
 * than trusting a client-supplied MRP. List Price is rounded before tax is
 * applied so the figures shown on screen (NDP → List Price → MRP) always add
 * up exactly as displayed.
 */
export function calculateListPrice(ndp: number, dealerMarginPercent: number): number {
  return round2(ndp * (1 + dealerMarginPercent / 100));
}

export function calculateMRP(ndp: number, dealerMarginPercent: number, taxPercent: number): number {
  return round2(calculateListPrice(ndp, dealerMarginPercent) * (1 + taxPercent / 100));
}

/**
 * Reverse-calculates NDP (dealer price, without tax) from MRP and Tax %, i.e.
 * NDP = MRP / (1 + Tax% / 100) with no dealer margin. Only the Excel imports
 * (which supply MRP, not NDP) use this; they store dealerMarginPercent as 0.
 */
export function calculateNDP(mrp: number, taxPercent: number): number {
  return round2(mrp / (1 + taxPercent / 100));
}

/**
 * Splits a tax-inclusive amount (e.g. sellingPrice × quantity, since selling
 * price always defaults to Part.mrp — always tax-inclusive) into its taxable
 * value and tax amount. Used by Sell Part so the amount actually charged
 * never changes — only how much of it is reported as taxable value vs. tax.
 * taxAmount is the remainder after rounding taxableValue, not an
 * independent rounding, so the two always reconcile exactly to the input.
 */
export function splitTaxInclusiveAmount(amount: number, taxPercent: number): { taxableValue: number; taxAmount: number } {
  const taxableValue = round2(amount / (1 + taxPercent / 100));
  const taxAmount = round2(amount - taxableValue);
  return { taxableValue, taxAmount };
}

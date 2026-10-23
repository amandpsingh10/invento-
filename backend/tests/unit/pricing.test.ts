import { describe, it, expect } from "vitest";
import { calculateNDP, calculateListPrice, calculateMRP, splitTaxInclusiveAmount } from "../../src/utils/pricing";

describe("calculateListPrice", () => {
  it("adds the dealer margin % to NDP (NDP 1000, margin 10% -> 1100)", () => {
    expect(calculateListPrice(1000, 10)).toBe(1100);
  });

  it("returns NDP unchanged at 0% margin", () => {
    expect(calculateListPrice(847.46, 0)).toBe(847.46);
  });

  it("rounds to 2 decimal places (NDP 99.99, margin 12.5% -> 112.49)", () => {
    expect(calculateListPrice(99.99, 12.5)).toBe(112.49);
  });
});

describe("calculateMRP", () => {
  it("applies tax on the List Price, not on NDP (NDP 1000, margin 10%, tax 18% -> 1298)", () => {
    expect(calculateMRP(1000, 10, 18)).toBe(1298);
  });

  it("is NDP plus tax when there is no margin (NDP 1000, margin 0%, tax 18% -> 1180)", () => {
    expect(calculateMRP(1000, 0, 18)).toBe(1180);
  });

  it("is the List Price when tax is 0% (NDP 500, margin 20%, tax 0% -> 600)", () => {
    expect(calculateMRP(500, 20, 0)).toBe(600);
  });

  it("taxes the rounded List Price so the on-screen chain adds up (NDP 99.99, margin 12.5%, tax 18% -> 132.74)", () => {
    // List Price rounds to 112.49; 112.49 * 1.18 = 132.7382 -> 132.74
    expect(calculateMRP(99.99, 12.5, 18)).toBe(132.74);
  });

  it("returns 0 for NDP 0", () => {
    expect(calculateMRP(0, 15, 18)).toBe(0);
  });
});

describe("splitTaxInclusiveAmount", () => {
  it("extracts taxable value and tax so they sum back to the input (1180 @ 18% -> 1000 + 180)", () => {
    expect(splitTaxInclusiveAmount(1180, 18)).toEqual({ taxableValue: 1000, taxAmount: 180 });
  });

  it("never exceeds the input amount — selling at full (tax-inclusive) MRP charges no tax on top", () => {
    const { taxableValue, taxAmount } = splitTaxInclusiveAmount(1180, 18);
    expect(taxableValue + taxAmount).toBe(1180);
  });

  it("returns the full amount as taxable and 0 tax when taxPercent is 0", () => {
    expect(splitTaxInclusiveAmount(500, 0)).toEqual({ taxableValue: 500, taxAmount: 0 });
  });

  it("returns zeros for a 0 amount", () => {
    expect(splitTaxInclusiveAmount(0, 18)).toEqual({ taxableValue: 0, taxAmount: 0 });
  });

  it("reconciles exactly even with odd-paisa rounding (999 @ 28%)", () => {
    const { taxableValue, taxAmount } = splitTaxInclusiveAmount(999, 28);
    expect(Math.round((taxableValue + taxAmount) * 100) / 100).toBe(999);
  });
});

describe("calculateNDP", () => {
  it("reverse-calculates NDP from MRP and Tax% (MRP 1180, Tax 18% -> 1000)", () => {
    expect(calculateNDP(1180, 18)).toBe(1000);
  });

  it("reverse-calculates NDP from MRP and Tax% (MRP 5900, Tax 18% -> 5000)", () => {
    expect(calculateNDP(5900, 18)).toBe(5000);
  });

  it("uses proper currency rounding, not integer rounding (MRP 1000, Tax 18% -> 847.46)", () => {
    expect(calculateNDP(1000, 18)).toBe(847.46);
  });

  it("returns 0 for MRP 0", () => {
    expect(calculateNDP(0, 18)).toBe(0);
  });

  it("returns MRP unchanged when Tax% is 0", () => {
    expect(calculateNDP(5000, 0)).toBe(5000);
  });

  it("rounds to exactly 2 decimal places", () => {
    const result = calculateNDP(999, 28);
    expect(result).toBe(Math.round((999 / 1.28) * 100) / 100);
    expect(result.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });
});

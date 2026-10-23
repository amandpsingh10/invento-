import { describe, it, expect } from "vitest";
import { isValidQuantityForUnit, resolveUnit, unitAllowsDecimalQuantity, isValidPartUnit } from "../../src/utils/quantity";

describe("unitAllowsDecimalQuantity", () => {
  it("allows decimals for ML, LTR and KGS", () => {
    expect(unitAllowsDecimalQuantity("ML")).toBe(true);
    expect(unitAllowsDecimalQuantity("LTR")).toBe(true);
    expect(unitAllowsDecimalQuantity("KGS")).toBe(true);
  });

  it("does not allow decimals for NOS", () => {
    expect(unitAllowsDecimalQuantity("NOS")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(unitAllowsDecimalQuantity("ml")).toBe(true);
    expect(unitAllowsDecimalQuantity("ltr")).toBe(true);
    expect(unitAllowsDecimalQuantity("kgs")).toBe(true);
  });

  it("defaults to NOS (no decimals) when unit is missing", () => {
    expect(unitAllowsDecimalQuantity(null)).toBe(false);
    expect(unitAllowsDecimalQuantity(undefined)).toBe(false);
    expect(unitAllowsDecimalQuantity("")).toBe(false);
  });
});

describe("isValidQuantityForUnit", () => {
  it("accepts whole numbers for every unit", () => {
    expect(isValidQuantityForUnit(5, "NOS")).toBe(true);
    expect(isValidQuantityForUnit(5, "LTR")).toBe(true);
    expect(isValidQuantityForUnit(5, "ML")).toBe(true);
    expect(isValidQuantityForUnit(5, "KGS")).toBe(true);
  });

  it("accepts fractional quantities for ML, LTR and KGS", () => {
    expect(isValidQuantityForUnit(1.5, "ML")).toBe(true);
    expect(isValidQuantityForUnit(2.5, "LTR")).toBe(true);
    expect(isValidQuantityForUnit(0.25, "KGS")).toBe(true);
  });

  it("rejects fractional quantities for NOS", () => {
    expect(isValidQuantityForUnit(1.5, "NOS")).toBe(false);
  });

  it("rejects non-finite quantities", () => {
    expect(isValidQuantityForUnit(NaN, "KGS")).toBe(false);
    expect(isValidQuantityForUnit(Infinity, "KGS")).toBe(false);
  });
});

describe("resolveUnit", () => {
  it("defaults blank/whitespace to NOS", () => {
    expect(resolveUnit("")).toBe("NOS");
    expect(resolveUnit("   ")).toBe("NOS");
    expect(resolveUnit(null)).toBe("NOS");
    expect(resolveUnit(undefined)).toBe("NOS");
  });

  it("normalizes case and whitespace for a recognized unit", () => {
    expect(resolveUnit(" ltr ")).toBe("LTR");
    expect(resolveUnit("kgs")).toBe("KGS");
  });

  it("returns null for an unrecognized unit", () => {
    expect(resolveUnit("GALLONS")).toBeNull();
    expect(resolveUnit("pcs")).toBeNull();
  });
});

describe("isValidPartUnit", () => {
  it("accepts the four recognized units case-insensitively", () => {
    expect(isValidPartUnit("NOS")).toBe(true);
    expect(isValidPartUnit("ltr")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidPartUnit("BOX")).toBe(false);
  });
});

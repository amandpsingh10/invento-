import { describe, it, expect } from "vitest";
import { validateRowFields } from "../../src/modules/purchases/purchases.validation";
import type { ParsedPurchaseRow } from "../../src/modules/purchases/purchases.excel";

function makeRow(overrides: Partial<ParsedPurchaseRow> = {}): ParsedPurchaseRow {
  return {
    rowNumber: 2,
    invoiceNo: "INV-10001",
    partNo: "BRK-PAD-001",
    partDescription: "Front Brake Pad",
    taxPercent: 28,
    hsnCode: "87083000",
    mrp: 5000,
    ndp: 3500,
    quantity: 10,
    storeCode: "MAIN",
    binCode: "BIN-01",
    rackCode: "RACK-03",
    ...overrides,
  };
}

describe("validateRowFields", () => {
  it("accepts a fully valid row", () => {
    expect(validateRowFields(makeRow())).toEqual([]);
  });

  it("flags a missing Invoice No", () => {
    expect(validateRowFields(makeRow({ invoiceNo: "" }))).toContain("Invoice No missing");
  });

  it("flags Quantity <= 0", () => {
    expect(validateRowFields(makeRow({ quantity: 0 }))).toContain("Quantity must be greater than 0");
    expect(validateRowFields(makeRow({ quantity: -5 }))).toContain("Quantity must be greater than 0");
  });

  it("flags non-numeric Quantity as null", () => {
    expect(validateRowFields(makeRow({ quantity: null }))).toContain("Quantity must be numeric");
  });

  it("flags negative MRP", () => {
    expect(validateRowFields(makeRow({ mrp: -100 }))).toContain("MRP cannot be negative");
  });

  it("flags negative NDP", () => {
    expect(validateRowFields(makeRow({ ndp: -1 }))).toContain("NDP cannot be negative");
  });

  it("flags Tax % outside 0-100", () => {
    expect(validateRowFields(makeRow({ taxPercent: 150 }))).toContain("Tax % must be between 0 and 100");
    expect(validateRowFields(makeRow({ taxPercent: -5 }))).toContain("Tax % must be between 0 and 100");
  });

  it("flags missing Store/Bin/Rack", () => {
    const errors = validateRowFields(makeRow({ storeCode: "", binCode: "", rackCode: "" }));
    expect(errors).toContain("Store is mandatory");
    expect(errors).toContain("Bin is mandatory");
    expect(errors).toContain("Rack is mandatory");
  });

  it("collects multiple errors on one row", () => {
    const errors = validateRowFields(makeRow({ invoiceNo: "", quantity: 0, mrp: -1 }));
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

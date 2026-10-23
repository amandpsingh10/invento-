import { describe, it, expect } from "vitest";
import { validatePartRowFields, validatePartRows } from "../../src/modules/parts/parts.import.validation";
import type { ParsedPartRow } from "../../src/modules/parts/parts.excel";

function makeRow(overrides: Partial<ParsedPartRow> = {}): ParsedPartRow {
  return {
    rowNumber: 2,
    partNo: "BRK-PAD-001",
    partDescription: "Front Brake Pad",
    taxPercent: 28,
    hsnCode: "87083000",
    mrp: 5000,
    ndp: 3500,
    unit: "NOS",
    category: "P",
    barcode: "",
    minimumStockLevel: 5,
    status: "ACTIVE",
    ...overrides,
  };
}

describe("validatePartRowFields", () => {
  it("accepts a fully valid row", () => {
    expect(validatePartRowFields(makeRow())).toEqual([]);
  });

  it("flags a missing Part No", () => {
    expect(validatePartRowFields(makeRow({ partNo: "" }))).toContain("Part No missing");
  });

  it("flags a missing Description", () => {
    expect(validatePartRowFields(makeRow({ partDescription: "" }))).toContain("Part Description missing");
  });

  it("flags Tax % outside 0-100", () => {
    expect(validatePartRowFields(makeRow({ taxPercent: 150 }))).toContain("Tax % must be between 0 and 100");
    expect(validatePartRowFields(makeRow({ taxPercent: -5 }))).toContain("Tax % must be between 0 and 100");
  });

  it("flags negative MRP", () => {
    expect(validatePartRowFields(makeRow({ mrp: -100 }))).toContain("MRP cannot be negative");
  });

  it("flags negative NDP", () => {
    expect(validatePartRowFields(makeRow({ ndp: -1 }))).toContain("NDP cannot be negative");
  });

  it("flags an unrecognized Unit", () => {
    expect(validatePartRowFields(makeRow({ unit: "BOX" }))).toContain('Unit "BOX" is not recognized — use NOS, LTR, ML or KGS');
  });

  it("accepts a blank Unit (defaults to NOS downstream)", () => {
    expect(validatePartRowFields(makeRow({ unit: "" }))).toEqual([]);
  });

  it("flags an unrecognized Category", () => {
    expect(validatePartRowFields(makeRow({ category: "X" }))).toContain('Category "X" is not recognized — use O, C, A or P');
  });

  it("accepts a blank Category (defaults to P downstream)", () => {
    expect(validatePartRowFields(makeRow({ category: "" }))).toEqual([]);
  });

  it("flags a negative or fractional Minimum Stock Level", () => {
    expect(validatePartRowFields(makeRow({ minimumStockLevel: -1 }))).toContain("Minimum Stock Level must be a whole number, 0 or greater");
    expect(validatePartRowFields(makeRow({ minimumStockLevel: 2.5 }))).toContain("Minimum Stock Level must be a whole number, 0 or greater");
  });

  it("flags an unrecognized Status", () => {
    expect(validatePartRowFields(makeRow({ status: "PENDING" }))).toContain('Status "PENDING" is not recognized — use ACTIVE or INACTIVE');
  });
});

describe("validatePartRows", () => {
  it("resolves blank Unit/Category/Status to their defaults", () => {
    const [row] = validatePartRows([makeRow({ unit: "", category: "", status: "" })]);
    expect(row.unit).toBe("NOS");
    expect(row.category).toBe("P");
    expect(row.status).toBe("ACTIVE");
    expect(row.isValid).toBe(true);
  });

  it("always recalculates NDP from MRP/Tax%, flagging a mismatch", () => {
    const [row] = validatePartRows([makeRow({ mrp: 5000, taxPercent: 28, ndp: 1 })]);
    expect(row.ndpMismatch).toBe(true);
    expect(row.ndp).toBeCloseTo(3906.25, 2);
  });

  it("flags duplicate Part No across rows in the same file", () => {
    const rows = validatePartRows([makeRow({ partNo: "DUP-001" }), makeRow({ partNo: "DUP-001" })]);
    expect(rows[0].isValid).toBe(false);
    expect(rows[1].isValid).toBe(false);
    expect(rows[0].errors.some((e) => e.includes("appears more than once"))).toBe(true);
  });

  it("does not flag Part No duplicates across different part numbers", () => {
    const rows = validatePartRows([makeRow({ partNo: "A-001" }), makeRow({ partNo: "B-001" })]);
    expect(rows[0].isValid).toBe(true);
    expect(rows[1].isValid).toBe(true);
  });
});

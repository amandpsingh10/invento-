import { describe, it, expect } from "vitest";
import { computeStockStatus } from "../../src/modules/inventory/inventory.service";

describe("computeStockStatus", () => {
  it("is OUT_OF_STOCK when quantity is zero or negative", () => {
    expect(computeStockStatus(0, 5)).toBe("OUT_OF_STOCK");
  });

  it("is LOW_STOCK when quantity is at or below the minimum", () => {
    expect(computeStockStatus(5, 5)).toBe("LOW_STOCK");
    expect(computeStockStatus(2, 5)).toBe("LOW_STOCK");
  });

  it("is IN_STOCK when quantity is above the minimum", () => {
    expect(computeStockStatus(6, 5)).toBe("IN_STOCK");
  });

  it("treats a zero minimum stock level correctly", () => {
    expect(computeStockStatus(1, 0)).toBe("IN_STOCK");
    expect(computeStockStatus(0, 0)).toBe("OUT_OF_STOCK");
  });
});

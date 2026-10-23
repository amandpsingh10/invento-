import { describe, it, expect } from "vitest";
import { resolveNdp } from "../../src/modules/purchases/purchases.validation";

describe("resolveNdp", () => {
  it("calculates NDP from MRP/Tax% when none was supplied (manual entry has no NDP field)", () => {
    const result = resolveNdp(1180, 18, null);
    expect(result.ndp).toBe(1000);
    expect(result.ndpMismatch).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it("accepts a supplied NDP that matches the calculated value", () => {
    const result = resolveNdp(1180, 18, 1000);
    expect(result.ndp).toBe(1000);
    expect(result.ndpMismatch).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it("flags and overrides a supplied NDP that disagrees with the calculated value (Excel cannot override calculated NDP)", () => {
    const result = resolveNdp(1180, 18, 3500);
    expect(result.ndp).toBe(1000);
    expect(result.ndpMismatch).toBe(true);
    expect(result.warnings[0]).toMatch(/does not match the calculated value/);
  });

  it("tolerates sub-paisa rounding noise without flagging a mismatch", () => {
    const result = resolveNdp(1000, 18, 847.46);
    expect(result.ndpMismatch).toBe(false);
    expect(result.ndp).toBe(847.46);
  });

  it("falls back to the supplied value when MRP is missing (can't calculate)", () => {
    const result = resolveNdp(null, 18, 500);
    expect(result.ndp).toBe(500);
    expect(result.ndpMismatch).toBe(false);
  });

  it("falls back to the supplied value when Tax% is out of range", () => {
    const result = resolveNdp(1180, 150, 1000);
    expect(result.ndp).toBe(1000);
    expect(result.ndpMismatch).toBe(false);
  });
});

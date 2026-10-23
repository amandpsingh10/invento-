import { describe, it, expect } from "vitest";
import { normalizeState } from "../../src/modules/sales/sales.service";

describe("normalizeState", () => {
  it("treats identical states as equal", () => {
    expect(normalizeState("Haryana")).toBe(normalizeState("Haryana"));
  });

  it("is case-insensitive", () => {
    expect(normalizeState("HARYANA")).toBe(normalizeState("haryana"));
  });

  it("ignores surrounding whitespace", () => {
    expect(normalizeState("  Haryana  ")).toBe(normalizeState("Haryana"));
  });

  it("treats different states as different", () => {
    expect(normalizeState("Haryana")).not.toBe(normalizeState("Punjab"));
  });

  it("normalizes null/undefined to an empty string, distinct from any real state", () => {
    expect(normalizeState(null)).toBe("");
    expect(normalizeState(undefined)).toBe("");
  });
});

import { describe, it, expect } from "vitest";
import { formatCurrency, formatNumber, cn } from "./utils";

describe("formatCurrency", () => {
  it("formats a number as INR currency", () => {
    expect(formatCurrency(5000)).toContain("5,000");
  });
  it("formats a string amount", () => {
    expect(formatCurrency("3500.50")).toContain("3,500.5");
  });
});

describe("formatNumber", () => {
  it("uses Indian digit grouping", () => {
    expect(formatNumber(100000)).toBe("1,00,000");
  });
});

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});

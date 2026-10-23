import { describe, it, expect } from "vitest";
import { createReturnSchema } from "../../src/modules/returns/returns.schema";

const issueItemId = "11111111-1111-1111-1111-111111111111";
const invoiceItemId = "22222222-2222-2222-2222-222222222222";

describe("createReturnSchema", () => {
  it("accepts a return against an issue item", () => {
    expect(createReturnSchema.safeParse({ issueItemId, quantity: 1 }).success).toBe(true);
  });

  it("accepts a return against an invoice item", () => {
    expect(createReturnSchema.safeParse({ invoiceItemId, quantity: 1 }).success).toBe(true);
  });

  it("rejects a return with neither issueItemId nor invoiceItemId", () => {
    expect(createReturnSchema.safeParse({ quantity: 1 }).success).toBe(false);
  });

  it("rejects a return with both issueItemId and invoiceItemId set", () => {
    expect(createReturnSchema.safeParse({ issueItemId, invoiceItemId, quantity: 1 }).success).toBe(false);
  });

  it("rejects a non-positive return quantity", () => {
    expect(createReturnSchema.safeParse({ issueItemId, quantity: 0 }).success).toBe(false);
  });
});

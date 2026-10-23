import { describe, it, expect } from "vitest";
import { createSaleSchema, customerInputSchema } from "../../src/modules/sales/sales.schema";

const validCustomer = {
  name: "Raj Kumar",
  mobile: "9876543210",
  address: "Ludhiana, Punjab",
  gstin: "03ABCDE1234F1Z5",
};

describe("customerInputSchema", () => {
  it("accepts a valid Indian mobile number", () => {
    expect(customerInputSchema.safeParse(validCustomer).success).toBe(true);
  });

  it("rejects a mobile number that isn't 10 digits", () => {
    const result = customerInputSchema.safeParse({ ...validCustomer, mobile: "12345" });
    expect(result.success).toBe(false);
  });

  it("rejects a mobile number not starting with 6-9", () => {
    const result = customerInputSchema.safeParse({ ...validCustomer, mobile: "1234567890" });
    expect(result.success).toBe(false);
  });

  it("requires customer name", () => {
    const result = customerInputSchema.safeParse({ ...validCustomer, name: "" });
    expect(result.success).toBe(false);
  });

  it("allows address to be omitted", () => {
    const { address, ...rest } = validCustomer;
    expect(customerInputSchema.safeParse(rest).success).toBe(true);
  });

  it("allows address to be an empty string", () => {
    const result = customerInputSchema.safeParse({ ...validCustomer, address: "" });
    expect(result.success).toBe(true);
  });

  it("allows GSTIN to be omitted", () => {
    const { gstin, ...rest } = validCustomer;
    expect(customerInputSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects a malformed GSTIN when one is provided", () => {
    const result = customerInputSchema.safeParse({ ...validCustomer, gstin: "not-a-gstin" });
    expect(result.success).toBe(false);
  });
});

describe("createSaleSchema", () => {
  it("requires at least one item in the cart", () => {
    const result = createSaleSchema.safeParse({ customer: validCustomer, items: [] });
    expect(result.success).toBe(false);
  });

  it("accepts a multi-part sale", () => {
    const result = createSaleSchema.safeParse({
      customer: validCustomer,
      items: [
        { inventoryId: "11111111-1111-1111-1111-111111111111", quantity: 2 },
        { inventoryId: "22222222-2222-2222-2222-222222222222", quantity: 1, sellingPrice: 1500 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a zero or negative quantity", () => {
    const result = createSaleSchema.safeParse({
      customer: validCustomer,
      items: [{ inventoryId: "11111111-1111-1111-1111-111111111111", quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });
});

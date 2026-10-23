import { describe, it, expect } from "vitest";
import { loginSchema, forgotPasswordSchema } from "../../src/modules/auth/auth.schema";

describe("loginSchema", () => {
  it("accepts a valid 10-digit mobile number and password", () => {
    const result = loginSchema.safeParse({ mobile: "9876543210", password: "Demo@1234" });
    expect(result.success).toBe(true);
  });

  it("rejects a mobile number shorter than 10 digits", () => {
    const result = loginSchema.safeParse({ mobile: "98765", password: "Demo@1234" });
    expect(result.success).toBe(false);
  });

  it("rejects a mobile number starting with 0-5 (not a valid Indian mobile prefix)", () => {
    const result = loginSchema.safeParse({ mobile: "1234567890", password: "Demo@1234" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric mobile number", () => {
    const result = loginSchema.safeParse({ mobile: "98ABCD3210", password: "Demo@1234" });
    expect(result.success).toBe(false);
  });

  it("rejects an email address in the mobile field — email login is not supported", () => {
    const result = loginSchema.safeParse({ mobile: "admin@demo.com", password: "Demo@1234" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing password", () => {
    const result = loginSchema.safeParse({ mobile: "9876543210", password: "" });
    expect(result.success).toBe(false);
  });

  it("does not require or accept a dealer code as part of the schema", () => {
    const result = loginSchema.safeParse({ mobile: "9876543210", password: "Demo@1234" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("dealerCode" in result.data).toBe(false);
    }
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid mobile number", () => {
    expect(forgotPasswordSchema.safeParse({ mobile: "9876543210" }).success).toBe(true);
  });

  it("rejects an invalid mobile number", () => {
    expect(forgotPasswordSchema.safeParse({ mobile: "123" }).success).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { applyInventoryDelta } from "../../src/modules/inventory/inventory.mutations";
import { ApiError } from "../../src/lib/apiError";

function fakeTx(updateSpy: (args: any) => void) {
  return {
    inventory: {
      update: async (args: any) => {
        updateSpy(args);
        return {};
      },
    },
  } as any;
}

describe("applyInventoryDelta", () => {
  it("increases balance for a positive delta (purchase/return)", async () => {
    let captured: any;
    const tx = fakeTx((args) => (captured = args));
    const newBalance = await applyInventoryDelta(tx, "inv-1", 10, 5);
    expect(newBalance).toBe(15);
    expect(captured.data.quantity).toBe(15);
  });

  it("decreases balance for a negative delta (issue)", async () => {
    const tx = fakeTx(() => undefined);
    const newBalance = await applyInventoryDelta(tx, "inv-1", 10, -3);
    expect(newBalance).toBe(7);
  });

  it("never allows the balance to go negative", async () => {
    const tx = fakeTx(() => undefined);
    await expect(applyInventoryDelta(tx, "inv-1", 5, -8)).rejects.toThrow(ApiError);
    await expect(applyInventoryDelta(tx, "inv-1", 5, -8)).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
      statusCode: 422,
    });
  });

  it("allows a delta that lands exactly on zero", async () => {
    const tx = fakeTx(() => undefined);
    const newBalance = await applyInventoryDelta(tx, "inv-1", 5, -5);
    expect(newBalance).toBe(0);
  });
});

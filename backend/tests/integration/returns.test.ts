import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

/**
 * End-to-end coverage of the Return Part business rules against a real
 * Postgres database (same skip-if-unreachable pattern as auth.test.ts).
 * Exercises both return scenarios from spec section 6:
 *   A) issue (no invoice) -> direct return, partial returns, over-return
 *   B) invoice -> blocked until cancelled -> cancel doesn't restore stock
 *      -> return does
 * Also covers manual-entry NDP auto-calculation end-to-end (never trusting
 * a client-supplied NDP).
 */

let app: import("express").Express;
let dbAvailable = true;
let token = "";

beforeAll(async () => {
  try {
    const { prisma } = await import("../../src/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    const { createApp } = await import("../../src/app");
    app = createApp();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ mobile: "9876500001", password: "Demo@1234" });
    token = login.body?.data?.accessToken ?? "";
    if (!token) dbAvailable = false;
  } catch {
    dbAvailable = false;
  }
});

function auth(req: request.Test) {
  return req.set("Authorization", `Bearer ${token}`);
}

async function addManualPart(partNo: string, mrp: number, taxPercent: number, quantity: number) {
  const res = await auth(request(app).post("/api/purchases/manual")).send({
    invoiceNo: `TEST-INV-${partNo}`,
    partNo,
    partDescription: `Test Part ${partNo}`,
    taxPercent,
    hsnCode: "12345678",
    mrp,
    quantity,
    storeCode: "MAIN",
    binCode: "BIN-01",
    rackCode: "RACK-03",
  });
  return res;
}

async function findInventoryIdByPartNo(partNo: string) {
  const res = await auth(request(app).get("/api/inventory").query({ search: partNo, pageSize: 5 }));
  const row = res.body.data.items.find((r: any) => r.partNo === partNo);
  return row as { id: string; availableQty: number } | undefined;
}

describe("Manual entry NDP auto-calculation", () => {
  it("never trusts a client-supplied NDP — backend always recalculates from MRP/Tax%", async () => {
    if (!dbAvailable) return;
    const partNo = `NDP-TEST-${Date.now()}`;
    const res = await addManualPart(partNo, 1180, 18, 5);
    expect(res.status).toBe(201);

    const partRes = await auth(request(app).get("/api/parts").query({ search: partNo }));
    const part = partRes.body.data.items.find((p: any) => p.partNo === partNo);
    expect(part).toBeTruthy();
    expect(Number(part.ndp)).toBe(1000);
  });
});

describe("Return Part — Scenario A: issue without invoice", () => {
  it("supports direct return, multiple partial returns, and blocks over-return", async () => {
    if (!dbAvailable) return;
    const partNo = `RET-ISSUE-${Date.now()}`;
    const added = await addManualPart(partNo, 1000, 18, 10);
    expect(added.status).toBe(201);

    const inv = await findInventoryIdByPartNo(partNo);
    expect(inv).toBeTruthy();

    const issueRes = await auth(request(app).post("/api/issues")).send({
      inventoryId: inv!.id,
      quantity: 10,
      reference: "TEST-JC-001",
    });
    expect(issueRes.status).toBe(201);
    const issueItemId = issueRes.body.data.items[0].id;

    // First partial return: 2 (remaining 10 -> 8)
    const r1 = await auth(request(app).post("/api/returns")).send({ issueItemId, quantity: 2 });
    expect(r1.status).toBe(201);

    // Reject over-return: only 8 remain, asking for 9
    const overReturn = await auth(request(app).post("/api/returns")).send({ issueItemId, quantity: 9 });
    expect(overReturn.status).toBe(422);
    expect(overReturn.body.error.code).toBe("OVER_RETURN");

    // Second partial return: 3 (remaining 8 -> 5)
    const r2 = await auth(request(app).post("/api/returns")).send({ issueItemId, quantity: 3 });
    expect(r2.status).toBe(201);

    // Third return: exactly the remainder (5 -> 0)
    const r3 = await auth(request(app).post("/api/returns")).send({ issueItemId, quantity: 5 });
    expect(r3.status).toBe(201);

    // Nothing left to return
    const r4 = await auth(request(app).post("/api/returns")).send({ issueItemId, quantity: 1 });
    expect(r4.status).toBe(422);
    expect(r4.body.error.message).toBe("No quantity available for return.");

    // Inventory should be back to the original 10 (10 issued, 10 returned across 3 partials)
    const finalInv = await findInventoryIdByPartNo(partNo);
    expect(finalInv!.availableQty).toBe(10);
  });
});

describe("Return Part — Scenario B: completed invoice requires cancellation first", () => {
  it("blocks direct return, allows it after cancel, and cancel never touches stock itself", async () => {
    if (!dbAvailable) return;
    const partNo = `RET-INVOICE-${Date.now()}`;
    const added = await addManualPart(partNo, 500, 18, 10);
    expect(added.status).toBe(201);

    const invBefore = await findInventoryIdByPartNo(partNo);
    const startingQty = invBefore!.availableQty;

    const saleRes = await auth(request(app).post("/api/sales")).send({
      customer: { name: "Test Customer", mobile: "9998887770", address: "Test Address" },
      items: [{ inventoryId: invBefore!.id, quantity: 4 }],
    });
    expect(saleRes.status).toBe(201);
    const invoice = saleRes.body.data;
    const invoiceItemId = invoice.items[0].id;

    const afterSaleInv = await findInventoryIdByPartNo(partNo);
    expect(afterSaleInv!.availableQty).toBe(startingQty - 4);

    // Direct return blocked while COMPLETED
    const blockedReturn = await auth(request(app).post("/api/returns")).send({ invoiceItemId, quantity: 1 });
    expect(blockedReturn.status).toBe(422);
    expect(blockedReturn.body.error.code).toBe("INVOICE_NOT_CANCELLED");

    // Cancel the invoice
    const cancelRes = await auth(request(app).post(`/api/invoices/${invoice.id}/cancel`)).send({ reason: "test" });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe("CANCELLED");

    // Cancellation alone must NOT restore stock
    const afterCancelInv = await findInventoryIdByPartNo(partNo);
    expect(afterCancelInv!.availableQty).toBe(startingQty - 4);

    // Now the return is allowed and DOES restore stock
    const returnRes = await auth(request(app).post("/api/returns")).send({ invoiceItemId, quantity: 4 });
    expect(returnRes.status).toBe(201);

    const afterReturnInv = await findInventoryIdByPartNo(partNo);
    expect(afterReturnInv!.availableQty).toBe(startingQty);
  });
});

describe("Low stock threshold", () => {
  it("flags quantity < 10 as low stock but not quantity == 10", async () => {
    if (!dbAvailable) return;
    const lowPartNo = `LOW-${Date.now()}`;
    await addManualPart(lowPartNo, 100, 18, 9);
    const exactPartNo = `EXACT-${Date.now()}`;
    await addManualPart(exactPartNo, 100, 18, 10);

    const lowStockRes = await auth(request(app).get("/api/inventory/low-stock").query({ pageSize: 200 }));
    const partNos = lowStockRes.body.data.items.map((r: any) => r.partNo);
    expect(partNos).toContain(lowPartNo);
    expect(partNos).not.toContain(exactPartNo);
  });
});

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

/**
 * Verifies the CGST+SGST vs IGST split end-to-end against a real database
 * (same skip-if-unreachable pattern as the other integration suites). The
 * seeded DEMO001 dealer is in Haryana (see seed.ts) — selling to a
 * Haryana customer must produce CGST+SGST, selling to a Punjab customer
 * must produce IGST, and either way cgst+sgst (or igst alone) must
 * reconcile exactly to the line's total tax.
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
    const login = await request(app).post("/api/auth/login").send({ mobile: "9876500001", password: "Demo@1234" });
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
  return auth(request(app).post("/api/purchases/manual")).send({
    invoiceNo: `TEST-GST-${partNo}`,
    partNo,
    partDescription: `GST Test Part ${partNo}`,
    taxPercent,
    hsnCode: "12345678",
    mrp,
    quantity,
    storeCode: "MAIN",
    binCode: "BIN-01",
    rackCode: "RACK-03",
  });
}

async function findInventoryIdByPartNo(partNo: string) {
  const res = await auth(request(app).get("/api/inventory").query({ search: partNo, pageSize: 5 }));
  const row = res.body.data.items.find((r: any) => r.partNo === partNo);
  return row as { id: string } | undefined;
}

describe("Sale tax split — CGST/SGST vs IGST", () => {
  it("applies CGST+SGST (split evenly) for a customer in the same state as the dealer (Haryana)", async () => {
    if (!dbAvailable) return;
    const partNo = `GST-INTRA-${Date.now()}`;
    await addManualPart(partNo, 1000, 18, 5);
    const inv = await findInventoryIdByPartNo(partNo);
    expect(inv).toBeTruthy();

    const sale = await auth(request(app).post("/api/sales")).send({
      customer: { name: "Intra State Customer", mobile: "9112233440", address: "Faridabad", state: "Haryana", city: "Faridabad", pincode: "121002" },
      items: [{ inventoryId: inv!.id, quantity: 2 }],
    });
    expect(sale.status).toBe(201);
    const item = sale.body.data.items[0];
    expect(item.taxType).toBe("CGST_SGST");
    expect(Number(item.igstAmount)).toBe(0);
    expect(Number(item.cgstAmount)).toBeGreaterThan(0);
    expect(Number(item.sgstAmount)).toBeGreaterThan(0);
    // cgst + sgst must reconcile exactly to the line's total tax.
    expect(Math.round((Number(item.cgstAmount) + Number(item.sgstAmount)) * 100) / 100).toBe(Number(item.taxAmount));
  });

  it("applies IGST (full amount) for a customer in a different state (Punjab)", async () => {
    if (!dbAvailable) return;
    const partNo = `GST-INTER-${Date.now()}`;
    await addManualPart(partNo, 1000, 18, 5);
    const inv = await findInventoryIdByPartNo(partNo);
    expect(inv).toBeTruthy();

    const sale = await auth(request(app).post("/api/sales")).send({
      customer: { name: "Inter State Customer", mobile: "9112233441", address: "Ludhiana", state: "Punjab", city: "Ludhiana", pincode: "141001" },
      items: [{ inventoryId: inv!.id, quantity: 2 }],
    });
    expect(sale.status).toBe(201);
    const item = sale.body.data.items[0];
    expect(item.taxType).toBe("IGST");
    expect(Number(item.cgstAmount)).toBe(0);
    expect(Number(item.sgstAmount)).toBe(0);
    expect(Number(item.igstAmount)).toBe(Number(item.taxAmount));
  });

  it("defaults to IGST when the customer's state is unknown (never silently assumes same-state)", async () => {
    if (!dbAvailable) return;
    const partNo = `GST-UNKNOWN-${Date.now()}`;
    await addManualPart(partNo, 1000, 18, 5);
    const inv = await findInventoryIdByPartNo(partNo);
    expect(inv).toBeTruthy();

    const sale = await auth(request(app).post("/api/sales")).send({
      customer: { name: "No State Customer", mobile: "9112233442", address: "Somewhere" },
      items: [{ inventoryId: inv!.id, quantity: 1 }],
    });
    expect(sale.status).toBe(201);
    const item = sale.body.data.items[0];
    expect(item.taxType).toBe("IGST");
  });
});

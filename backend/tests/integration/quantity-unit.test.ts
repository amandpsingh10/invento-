import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

/**
 * End-to-end coverage of the Unit (NOS/LTR/ML/KGS) + decimal-quantity
 * feature against a real database (same skip-if-unreachable pattern as
 * the other integration suites). ML, LTR and KGS must accept fractional
 * quantities everywhere a quantity is entered (manual purchase entry,
 * sale); NOS must reject them with a clear error, not a generic
 * schema-validation failure.
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

async function findInventoryIdByPartNo(partNo: string) {
  const res = await auth(request(app).get("/api/inventory").query({ search: partNo, pageSize: 5 }));
  const row = res.body.data.items.find((r: any) => r.partNo === partNo);
  return row as { id: string; unit: string } | undefined;
}

describe("Manual entry — decimal quantity by unit", () => {
  it("accepts a fractional quantity for a KGS part", async () => {
    if (!dbAvailable) return;
    const partNo = `UNIT-KGS-${Date.now()}`;
    const res = await auth(request(app).post("/api/purchases/manual")).send({
      invoiceNo: `TEST-UNIT-${partNo}`,
      partNo,
      partDescription: "Grease (KGS)",
      taxPercent: 18,
      hsnCode: "12345678",
      mrp: 500,
      unit: "KGS",
      quantity: 2.5,
      storeCode: "MAIN",
      binCode: "BIN-01",
      rackCode: "RACK-03",
    });
    expect(res.status).toBe(201);

    const inv = await findInventoryIdByPartNo(partNo);
    expect(inv?.unit).toBe("KGS");
  });

  it("accepts a fractional quantity for an ML part", async () => {
    if (!dbAvailable) return;
    const partNo = `UNIT-ML-${Date.now()}`;
    const res = await auth(request(app).post("/api/purchases/manual")).send({
      invoiceNo: `TEST-UNIT-${partNo}`,
      partNo,
      partDescription: "Coolant (ML)",
      taxPercent: 18,
      hsnCode: "12345678",
      mrp: 300,
      unit: "ML",
      quantity: 750.5,
      storeCode: "MAIN",
      binCode: "BIN-01",
      rackCode: "RACK-03",
    });
    expect(res.status).toBe(201);
  });

  it("rejects a fractional quantity for a NOS part", async () => {
    if (!dbAvailable) return;
    const partNo = `UNIT-NOS-${Date.now()}`;
    const res = await auth(request(app).post("/api/purchases/manual")).send({
      invoiceNo: `TEST-UNIT-${partNo}`,
      partNo,
      partDescription: "Brake Pad (NOS)",
      taxPercent: 18,
      hsnCode: "12345678",
      mrp: 500,
      unit: "NOS",
      quantity: 1.5,
      storeCode: "MAIN",
      binCode: "BIN-01",
      rackCode: "RACK-03",
    });
    expect(res.status).toBe(400);
  });

  it("accepts a fractional quantity for a LTR part", async () => {
    if (!dbAvailable) return;
    const partNo = `UNIT-LTR-${Date.now()}`;
    const res = await auth(request(app).post("/api/purchases/manual")).send({
      invoiceNo: `TEST-UNIT-${partNo}`,
      partNo,
      partDescription: "Engine Oil (LTR)",
      taxPercent: 18,
      hsnCode: "12345678",
      mrp: 500,
      unit: "LTR",
      quantity: 1.5,
      storeCode: "MAIN",
      binCode: "BIN-01",
      rackCode: "RACK-03",
    });
    expect(res.status).toBe(201);
  });
});

describe("Sale — decimal quantity by unit", () => {
  it("allows selling a fractional quantity of a KGS part and updates stock correctly", async () => {
    if (!dbAvailable) return;
    const partNo = `SALE-KGS-${Date.now()}`;
    await auth(request(app).post("/api/purchases/manual")).send({
      invoiceNo: `TEST-SALE-${partNo}`,
      partNo,
      partDescription: "Grease (KGS) for sale",
      taxPercent: 18,
      hsnCode: "12345678",
      mrp: 500,
      unit: "KGS",
      quantity: 10,
      storeCode: "MAIN",
      binCode: "BIN-01",
      rackCode: "RACK-03",
    });
    const inv = await findInventoryIdByPartNo(partNo);
    expect(inv).toBeTruthy();

    const sale = await auth(request(app).post("/api/sales")).send({
      customer: { name: "Decimal Qty Customer", mobile: "9112233450", address: "Test" },
      items: [{ inventoryId: inv!.id, quantity: 2.5 }],
    });
    expect(sale.status).toBe(201);
    expect(sale.body.data.items[0].quantity).toBe(2.5);

    const afterInv = await findInventoryIdByPartNo(partNo);
    const afterRes = await auth(request(app).get("/api/inventory").query({ search: partNo, pageSize: 5 }));
    const row = afterRes.body.data.items.find((r: any) => r.partNo === partNo);
    expect(row.availableQty).toBe(7.5);
    void afterInv;
  });

  it("rejects a fractional sale quantity for a NOS part with a clear error, not a generic validation failure", async () => {
    if (!dbAvailable) return;
    const partNo = `SALE-NOS-${Date.now()}`;
    await auth(request(app).post("/api/purchases/manual")).send({
      invoiceNo: `TEST-SALE-${partNo}`,
      partNo,
      partDescription: "Brake Pad (NOS) for sale",
      taxPercent: 18,
      hsnCode: "12345678",
      mrp: 500,
      unit: "NOS",
      quantity: 5,
      storeCode: "MAIN",
      binCode: "BIN-01",
      rackCode: "RACK-03",
    });
    const inv = await findInventoryIdByPartNo(partNo);
    expect(inv).toBeTruthy();

    const sale = await auth(request(app).post("/api/sales")).send({
      customer: { name: "Bad Qty Customer", mobile: "9112233451", address: "Test" },
      items: [{ inventoryId: inv!.id, quantity: 1.5 }],
    });
    expect(sale.status).toBe(422);
    expect(sale.body.error.code).toBe("FRACTIONAL_QUANTITY_NOT_ALLOWED");
  });
});

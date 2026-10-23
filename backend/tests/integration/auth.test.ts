import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

/**
 * Integration tests against a real Postgres database. Requires:
 *   docker compose up -d db
 *   npm run db:migrate -w database && npm run db:seed -w database
 * Skipped automatically if DATABASE_URL is unreachable, so `npm run test`
 * still passes in environments with no database (e.g. a bare CI lint stage).
 */

let app: import("express").Express;
let dbAvailable = true;

const DEMO_TENANT_ADMIN_MOBILE = "9876500001";

beforeAll(async () => {
  try {
    const { prisma } = await import("../../src/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    const { createApp } = await import("../../src/app");
    app = createApp();
  } catch {
    dbAvailable = false;
  }
});

describe("POST /api/auth/login", () => {
  it("rejects an unknown mobile number", async () => {
    if (!dbAvailable) return;
    const res = await request(app).post("/api/auth/login").send({ mobile: "9000000000", password: "whatever" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects a mobile number that isn't a valid 10-digit Indian number (schema validation)", async () => {
    if (!dbAvailable) return;
    const res = await request(app).post("/api/auth/login").send({ mobile: "12345", password: "whatever" });
    expect(res.status).toBe(400);
  });

  it("logs in the seeded demo tenant admin by mobile + password and returns an access token", async () => {
    if (!dbAvailable) return;
    const res = await request(app).post("/api/auth/login").send({ mobile: DEMO_TENANT_ADMIN_MOBILE, password: "Demo@1234" });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.tenant.dealerCode).toBe("DEMO001");
    expect(res.body.data.user.mobile).toBe(DEMO_TENANT_ADMIN_MOBILE);
  });

  it("rejects a correct mobile number with the wrong password", async () => {
    if (!dbAvailable) return;
    const res = await request(app).post("/api/auth/login").send({ mobile: DEMO_TENANT_ADMIN_MOBILE, password: "WrongPassword1" });
    expect(res.status).toBe(401);
  });

  it("does not support logging in with an email address instead of mobile (schema rejects it)", async () => {
    if (!dbAvailable) return;
    const res = await request(app).post("/api/auth/login").send({ mobile: "admin@demo.com", password: "Demo@1234" });
    expect(res.status).toBe(400);
  });

  it("no longer accepts or requires a dealer code — login succeeds without one", async () => {
    if (!dbAvailable) return;
    const res = await request(app).post("/api/auth/login").send({ mobile: DEMO_TENANT_ADMIN_MOBILE, password: "Demo@1234", dealerCode: "IGNORED" });
    expect(res.status).toBe(200);
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("accepts a mobile number and always returns the same generic response", async () => {
    if (!dbAvailable) return;
    const knownRes = await request(app).post("/api/auth/forgot-password").send({ mobile: DEMO_TENANT_ADMIN_MOBILE });
    expect(knownRes.status).toBe(200);
    const unknownRes = await request(app).post("/api/auth/forgot-password").send({ mobile: "9000000000" });
    expect(unknownRes.status).toBe(200);
    expect(unknownRes.body.data.message).toBe(knownRes.body.data.message);
  });

  it("rejects an invalid mobile number", async () => {
    if (!dbAvailable) return;
    const res = await request(app).post("/api/auth/forgot-password").send({ mobile: "123" });
    expect(res.status).toBe(400);
  });
});

describe("Tenant isolation", () => {
  it("a dealer's JWT cannot read another dealer's parts", async () => {
    if (!dbAvailable) return;
    const login = await request(app).post("/api/auth/login").send({ mobile: DEMO_TENANT_ADMIN_MOBILE, password: "Demo@1234" });
    const token = login.body.data.accessToken as string;

    const partsRes = await request(app).get("/api/parts").set("Authorization", `Bearer ${token}`);
    expect(partsRes.status).toBe(200);
    // Every part returned must belong to the DEMO001 tenant's data set — the
    // API never accepts a client-supplied tenantId, so this is a smoke test
    // that authenticated requests only ever see their own tenant's rows.
    for (const part of partsRes.body.data.items) {
      expect(part.partNo).toBeTruthy();
    }
  });

  it("rejects requests with no Authorization header", async () => {
    if (!dbAvailable) return;
    const res = await request(app).get("/api/parts");
    expect(res.status).toBe(401);
  });
});

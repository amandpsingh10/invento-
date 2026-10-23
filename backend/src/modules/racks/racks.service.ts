import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import type { z } from "zod";
import type { createRackSchema, updateRackSchema } from "./racks.schema";

export async function listRacks(tenantId: string, storeId?: string) {
  return prisma.rack.findMany({
    where: { tenantId, ...(storeId ? { storeId } : {}) },
    include: { store: { select: { id: true, name: true, code: true } } },
    orderBy: { code: "asc" },
  });
}

export async function getRack(tenantId: string, id: string) {
  const rack = await prisma.rack.findFirst({ where: { id, tenantId } });
  if (!rack) throw ApiError.notFound("Rack not found");
  return rack;
}

async function assertStoreBelongsToTenant(tenantId: string, storeId: string) {
  const store = await prisma.store.findFirst({ where: { id: storeId, tenantId } });
  if (!store) throw ApiError.badRequest("Selected store does not exist", "INVALID_STORE");
}

export async function createRack(tenantId: string, input: z.infer<typeof createRackSchema>) {
  await assertStoreBelongsToTenant(tenantId, input.storeId);
  const existing = await prisma.rack.findUnique({
    where: { tenantId_storeId_code: { tenantId, storeId: input.storeId, code: input.code } },
  });
  if (existing) throw ApiError.conflict(`Rack code "${input.code}" already exists in this store`, "DUPLICATE_RACK_CODE");
  return prisma.rack.create({ data: { tenantId, ...input } });
}

export async function updateRack(tenantId: string, id: string, input: z.infer<typeof updateRackSchema>) {
  const rack = await getRack(tenantId, id);
  const storeId = input.storeId ?? rack.storeId;
  if (input.storeId) await assertStoreBelongsToTenant(tenantId, input.storeId);
  if (input.code) {
    const existing = await prisma.rack.findUnique({ where: { tenantId_storeId_code: { tenantId, storeId, code: input.code } } });
    if (existing && existing.id !== id) {
      throw ApiError.conflict(`Rack code "${input.code}" already exists in this store`, "DUPLICATE_RACK_CODE");
    }
  }
  return prisma.rack.update({ where: { id }, data: input });
}

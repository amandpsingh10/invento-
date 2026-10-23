import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import type { z } from "zod";
import type { createBinSchema, updateBinSchema } from "./bins.schema";

export async function listBins(tenantId: string, storeId?: string) {
  return prisma.bin.findMany({
    where: { tenantId, ...(storeId ? { storeId } : {}) },
    include: { store: { select: { id: true, name: true, code: true } } },
    orderBy: { code: "asc" },
  });
}

export async function getBin(tenantId: string, id: string) {
  const bin = await prisma.bin.findFirst({ where: { id, tenantId } });
  if (!bin) throw ApiError.notFound("Bin not found");
  return bin;
}

async function assertStoreBelongsToTenant(tenantId: string, storeId: string) {
  const store = await prisma.store.findFirst({ where: { id: storeId, tenantId } });
  if (!store) throw ApiError.badRequest("Selected store does not exist", "INVALID_STORE");
}

export async function createBin(tenantId: string, input: z.infer<typeof createBinSchema>) {
  await assertStoreBelongsToTenant(tenantId, input.storeId);
  const existing = await prisma.bin.findUnique({
    where: { tenantId_storeId_code: { tenantId, storeId: input.storeId, code: input.code } },
  });
  if (existing) throw ApiError.conflict(`Bin code "${input.code}" already exists in this store`, "DUPLICATE_BIN_CODE");
  return prisma.bin.create({ data: { tenantId, ...input } });
}

export async function updateBin(tenantId: string, id: string, input: z.infer<typeof updateBinSchema>) {
  const bin = await getBin(tenantId, id);
  const storeId = input.storeId ?? bin.storeId;
  if (input.storeId) await assertStoreBelongsToTenant(tenantId, input.storeId);
  if (input.code) {
    const existing = await prisma.bin.findUnique({ where: { tenantId_storeId_code: { tenantId, storeId, code: input.code } } });
    if (existing && existing.id !== id) {
      throw ApiError.conflict(`Bin code "${input.code}" already exists in this store`, "DUPLICATE_BIN_CODE");
    }
  }
  return prisma.bin.update({ where: { id }, data: input });
}

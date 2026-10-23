import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import type { z } from "zod";
import type { createStoreSchema, updateStoreSchema } from "./stores.schema";

export async function listStores(tenantId: string, search?: string) {
  return prisma.store.findMany({
    where: {
      tenantId,
      ...(search
        ? { OR: [{ code: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] }
        : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function getStore(tenantId: string, id: string) {
  const store = await prisma.store.findFirst({ where: { id, tenantId } });
  if (!store) throw ApiError.notFound("Store not found");
  return store;
}

export async function createStore(tenantId: string, input: z.infer<typeof createStoreSchema>) {
  const existing = await prisma.store.findUnique({ where: { tenantId_code: { tenantId, code: input.code } } });
  if (existing) throw ApiError.conflict(`Store code "${input.code}" already exists`, "DUPLICATE_STORE_CODE");
  return prisma.store.create({ data: { tenantId, ...input } });
}

export async function updateStore(tenantId: string, id: string, input: z.infer<typeof updateStoreSchema>) {
  await getStore(tenantId, id);
  if (input.code) {
    const existing = await prisma.store.findUnique({ where: { tenantId_code: { tenantId, code: input.code } } });
    if (existing && existing.id !== id) {
      throw ApiError.conflict(`Store code "${input.code}" already exists`, "DUPLICATE_STORE_CODE");
    }
  }
  return prisma.store.update({ where: { id }, data: input });
}

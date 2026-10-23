import { Prisma } from "@parts-inventory-system/database";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { buildPageResult } from "../../utils/pagination";

export type StockStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK";

export function computeStockStatus(quantity: number, minimumStockLevel: number): StockStatus {
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (quantity <= minimumStockLevel) return "LOW_STOCK";
  return "IN_STOCK";
}

export async function listCurrentStock(
  tenantId: string,
  opts: {
    page: number;
    pageSize: number;
    search?: string;
    storeId?: string;
    binId?: string;
    rackId?: string;
    status?: StockStatus;
  }
) {
  const where: Prisma.InventoryWhereInput = {
    tenantId,
    ...(opts.storeId ? { storeId: opts.storeId } : {}),
    ...(opts.binId ? { binId: opts.binId } : {}),
    ...(opts.rackId ? { rackId: opts.rackId } : {}),
    ...(opts.search
      ? {
          part: {
            OR: [
              { partNo: { contains: opts.search, mode: "insensitive" } },
              { description: { contains: opts.search, mode: "insensitive" } },
              { barcode: { equals: opts.search, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };

  const include = {
    part: true,
    store: { select: { id: true, code: true, name: true } },
    bin: { select: { id: true, code: true } },
    rack: { select: { id: true, code: true } },
  } as const;

  const toRow = (r: Prisma.InventoryGetPayload<{ include: typeof include }>) => ({
    id: r.id,
    partId: r.partId,
    partNo: r.part.partNo,
    description: r.part.description,
    store: r.store,
    bin: r.bin,
    rack: r.rack,
    mrp: r.part.mrp,
    ndp: r.part.ndp,
    taxPercent: r.part.taxPercent,
    unit: r.part.unit,
    category: r.part.category,
    // quantity is Decimal(12,3) in the DB (to support fractional ML/KGS
    // amounts) — Number()-converted here, at the service/API boundary, so
    // every downstream consumer (this function's own status calc, the
    // frontend) keeps working with a plain JS number exactly as before.
    availableQty: Number(r.quantity),
    minimumStockLevel: r.part.minimumStockLevel,
    status: computeStockStatus(Number(r.quantity), r.part.minimumStockLevel),
    updatedAt: r.updatedAt,
  });

  // Stock status (IN/LOW/OUT) is derived from quantity vs. a per-part
  // threshold, so it can't be pushed into a Prisma `where`. When filtering
  // by status we page over the tenant's inventory in DB-sized batches
  // instead of loading everything at once, keeping this workable for large
  // catalogs without a raw-SQL CASE expression.
  if (opts.status) {
    const BATCH_SIZE = 500;
    const matched: ReturnType<typeof toRow>[] = [];
    let skip = 0;
    let filteredTotal = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = await prisma.inventory.findMany({
        where,
        include,
        orderBy: [{ part: { partNo: "asc" } }],
        skip,
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;
      for (const r of batch) {
        const row = toRow(r);
        if (row.status === opts.status) {
          filteredTotal++;
          if (filteredTotal > (opts.page - 1) * opts.pageSize && matched.length < opts.pageSize) {
            matched.push(row);
          }
        }
      }
      skip += BATCH_SIZE;
      if (batch.length < BATCH_SIZE) break;
    }
    return buildPageResult(matched, filteredTotal, opts.page, opts.pageSize);
  }

  const [rows, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      include,
      orderBy: [{ part: { partNo: "asc" } }],
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.inventory.count({ where }),
  ]);

  return buildPageResult(rows.map(toRow), total, opts.page, opts.pageSize);
}

export async function getInventoryById(tenantId: string, id: string) {
  const inv = await prisma.inventory.findFirst({
    where: { id, tenantId },
    include: { part: true, store: true, bin: true, rack: true },
  });
  if (!inv) throw ApiError.notFound("Inventory record not found");
  return { ...inv, quantity: Number(inv.quantity) };
}

export async function getInventoryHistory(tenantId: string, id: string, page: number, pageSize: number) {
  await getInventoryById(tenantId, id);
  const where = { tenantId, inventoryId: id };
  const [rows, total] = await Promise.all([
    prisma.stockLedger.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockLedger.count({ where }),
  ]);
  const items = rows.map((r) => ({ ...r, quantityChange: Number(r.quantityChange), balanceQuantity: Number(r.balanceQuantity) }));
  return buildPageResult(items, total, page, pageSize);
}

/**
 * Dashboard "Low Stock" card/screen definition: available quantity below
 * the tenant's configurable lowStockThreshold (default 10) — a simpler,
 * single tenant-wide number distinct from the richer per-part
 * minimumStockLevel that drives Current Stock's IN/LOW/OUT badges.
 * Computed live from Inventory on every call — never cached/hard-coded.
 */
export async function listLowStock(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string; storeId?: string }
) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { lowStockThreshold: true } });

  const where: Prisma.InventoryWhereInput = {
    tenantId,
    quantity: { lt: tenant.lowStockThreshold },
    ...(opts.storeId ? { storeId: opts.storeId } : {}),
    ...(opts.search
      ? {
          part: {
            OR: [
              { partNo: { contains: opts.search, mode: "insensitive" } },
              { description: { contains: opts.search, mode: "insensitive" } },
              { barcode: { equals: opts.search, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      include: {
        part: true,
        store: { select: { id: true, code: true, name: true } },
        bin: { select: { id: true, code: true } },
        rack: { select: { id: true, code: true } },
      },
      orderBy: [{ quantity: "asc" }], // lowest quantity first, per spec's default sort
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.inventory.count({ where }),
  ]);

  const items = rows.map((r) => {
    const availableQty = Number(r.quantity);
    return {
      id: r.id,
      partId: r.partId,
      partNo: r.part.partNo,
      description: r.part.description,
      store: r.store,
      bin: r.bin,
      rack: r.rack,
      mrp: r.part.mrp,
      ndp: r.part.ndp,
      taxPercent: r.part.taxPercent,
      unit: r.part.unit,
      category: r.part.category,
      availableQty,
      status: availableQty <= 0 ? "OUT_OF_STOCK" : ("LOW_STOCK" as const),
      updatedAt: r.updatedAt,
    };
  });

  return { ...buildPageResult(items, total, opts.page, opts.pageSize), lowStockThreshold: tenant.lowStockThreshold };
}

export async function getDashboardStockCounts(tenantId: string) {
  const parts = await prisma.part.findMany({
    where: { tenantId, status: "ACTIVE" },
    select: { id: true, minimumStockLevel: true },
  });
  const inventory = await prisma.inventory.groupBy({
    by: ["partId"],
    where: { tenantId },
    _sum: { quantity: true },
  });
  // Prisma's _sum on a Decimal column returns Prisma.Decimal | null, not a
  // plain number — Number()-converted immediately so every use below is
  // safe (Decimal + number in JS is a string-concat trap, not addition;
  // see returns.service.ts for the exact bug this avoids).
  const qtyByPart = new Map(inventory.map((i) => [i.partId, Number(i._sum.quantity ?? 0)]));

  let lowStock = 0;
  let outOfStock = 0;
  let totalStockQty = 0;
  for (const part of parts) {
    const qty = qtyByPart.get(part.id) ?? 0;
    totalStockQty += qty;
    const status = computeStockStatus(qty, part.minimumStockLevel);
    if (status === "LOW_STOCK") lowStock++;
    if (status === "OUT_OF_STOCK") outOfStock++;
  }

  return { totalParts: parts.length, totalStockQty, lowStock, outOfStock };
}

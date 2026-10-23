import { Prisma } from "@parts-inventory-system/database";
import { prisma } from "../../lib/prisma";
import { buildPageResult } from "../../utils/pagination";
import { buildLedgerWhere, type LedgerFilters } from "../ledger/ledger.service";

export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

export interface StockReportFilters extends DateRangeFilter {
  storeId?: string;
  partId?: string;
  search?: string;
  category?: string;
}

export async function stockReport(tenantId: string, filters: StockReportFilters, page: number, pageSize: number) {
  const where: Prisma.InventoryWhereInput = {
    tenantId,
    ...(filters.storeId ? { storeId: filters.storeId } : {}),
    ...(filters.partId ? { partId: filters.partId } : {}),
    ...((filters.search || filters.category)
      ? {
          part: {
            ...(filters.search
              ? {
                  OR: [
                    { partNo: { contains: filters.search, mode: "insensitive" } },
                    { description: { contains: filters.search, mode: "insensitive" } },
                  ],
                }
              : {}),
            ...(filters.category ? { category: filters.category } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      include: { part: true, store: true, bin: true, rack: true },
      orderBy: [{ part: { partNo: "asc" } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventory.count({ where }),
  ]);

  const inventoryIds = rows.map((r) => r.id);
  if (inventoryIds.length === 0) return buildPageResult([], total, page, pageSize);

  const [openingAgg, rangeAgg] = await Promise.all([
    prisma.stockLedger.groupBy({
      by: ["inventoryId"],
      where: { tenantId, inventoryId: { in: inventoryIds }, ...(filters.from ? { createdAt: { lt: filters.from } } : { createdAt: { lt: new Date(0) } }) },
      _sum: { quantityChange: true },
    }),
    prisma.stockLedger.groupBy({
      by: ["inventoryId", "transactionType"],
      where: {
        tenantId,
        inventoryId: { in: inventoryIds },
        ...(filters.from || filters.to ? { createdAt: { gte: filters.from, lte: filters.to } } : {}),
      },
      _sum: { quantityChange: true },
    }),
  ]);

  // _sum on a Decimal(12,3) column returns Prisma.Decimal | null, not a
  // plain number — Number()-converted immediately, since `+=` between a
  // plain number and a raw Decimal silently does string concatenation
  // instead of addition (Decimal.valueOf() returns a string).
  const openingByInv = new Map(openingAgg.map((r) => [r.inventoryId, Number(r._sum.quantityChange ?? 0)]));

  const movementByInv = new Map<string, { purchase: number; issue: number; return: number; adjustment: number }>();
  for (const id of inventoryIds) movementByInv.set(id, { purchase: 0, issue: 0, return: 0, adjustment: 0 });
  for (const r of rangeAgg) {
    const bucket = movementByInv.get(r.inventoryId)!;
    const qty = Number(r._sum.quantityChange ?? 0);
    if (r.transactionType === "PURCHASE") bucket.purchase += qty;
    else if (r.transactionType === "ISSUE") bucket.issue += Math.abs(qty);
    else if (r.transactionType === "RETURN") bucket.return += qty;
    else if (r.transactionType === "ADJUSTMENT" || r.transactionType === "CORRECTION") bucket.adjustment += qty;
  }

  const items = rows.map((inv) => {
    const opening = filters.from ? openingByInv.get(inv.id) ?? 0 : 0;
    const movement = movementByInv.get(inv.id)!;
    const closing = opening + movement.purchase + movement.return + movement.adjustment - movement.issue;
    return {
      inventoryId: inv.id,
      partNo: inv.part.partNo,
      description: inv.part.description,
      unit: inv.part.unit,
      store: inv.store.name,
      bin: inv.bin.code,
      rack: inv.rack.code,
      opening,
      purchase: movement.purchase,
      issue: movement.issue,
      return: movement.return,
      adjustment: movement.adjustment,
      closing: filters.from || filters.to ? closing : Number(inv.quantity),
    };
  });

  return buildPageResult(items, total, page, pageSize);
}

export async function issueReport(
  tenantId: string,
  filters: DateRangeFilter & { storeId?: string; category?: string },
  page: number,
  pageSize: number
) {
  const where: Prisma.IssueWhereInput = {
    tenantId,
    ...(filters.from || filters.to ? { issueDate: { gte: filters.from, lte: filters.to } } : {}),
    // Both conditions (when present) target the same "some" clause — two
    // separate `items` keys would collide in this object literal and
    // silently drop whichever came first.
    ...((filters.storeId || filters.category)
      ? {
          items: {
            some: {
              ...(filters.storeId ? { inventory: { storeId: filters.storeId } } : {}),
              ...(filters.category ? { part: { category: filters.category } } : {}),
            },
          },
        }
      : {}),
  };
  const [issues, total] = await Promise.all([
    prisma.issue.findMany({
      where,
      include: { items: { include: { part: true, inventory: { include: { store: true } } } }, createdBy: true },
      orderBy: { issueDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.issue.count({ where }),
  ]);

  const rows = issues.flatMap((issue) =>
    issue.items.map((item) => ({
      issueNumber: issue.issueNumber,
      issueDate: issue.issueDate,
      reference: issue.reference ?? "",
      partNo: item.part.partNo,
      description: item.part.description,
      unit: item.part.unit,
      store: item.inventory.store.name,
      quantity: Number(item.quantity),
      returnedQty: Number(item.returnedQty),
      status: issue.status,
      createdBy: `${issue.createdBy.firstName} ${issue.createdBy.lastName}`,
    }))
  );

  return buildPageResult(rows, total, page, pageSize);
}

export async function returnReport(tenantId: string, filters: DateRangeFilter & { category?: string }, page: number, pageSize: number) {
  const where: Prisma.ReturnWhereInput = {
    tenantId,
    ...(filters.from || filters.to ? { returnDate: { gte: filters.from, lte: filters.to } } : {}),
    ...(filters.category ? { items: { some: { part: { category: filters.category } } } } : {}),
  };
  const [returns, total] = await Promise.all([
    prisma.return.findMany({
      where,
      include: { items: { include: { part: true } }, issue: true, invoice: true, createdBy: true },
      orderBy: { returnDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.return.count({ where }),
  ]);

  const rows = returns.flatMap((ret) =>
    ret.items.map((item) => ({
      returnNumber: ret.returnNumber,
      returnDate: ret.returnDate,
      issueNumber: ret.issue?.issueNumber ?? ret.invoice?.invoiceNumber ?? "—",
      partNo: item.part.partNo,
      description: item.part.description,
      unit: item.part.unit,
      quantity: Number(item.quantity),
      createdBy: `${ret.createdBy.firstName} ${ret.createdBy.lastName}`,
    }))
  );

  return buildPageResult(rows, total, page, pageSize);
}

export async function transactionReport(tenantId: string, filters: LedgerFilters, page: number, pageSize: number) {
  const where = buildLedgerWhere(tenantId, filters);
  const [rows, total] = await Promise.all([
    prisma.stockLedger.findMany({
      where,
      include: { part: true, inventory: { include: { store: true, bin: true, rack: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockLedger.count({ where }),
  ]);
  const items = rows.map((r) => ({ ...r, quantityChange: Number(r.quantityChange), balanceQuantity: Number(r.balanceQuantity) }));
  return buildPageResult(items, total, page, pageSize);
}

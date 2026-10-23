import { Prisma } from "@parts-inventory-system/database";
import { prisma } from "../../lib/prisma";
import { buildPageResult } from "../../utils/pagination";

export interface LedgerFilters {
  partId?: string;
  storeId?: string;
  transactionType?: string;
  invoiceNumber?: string;
  transactionNumber?: string;
  from?: Date;
  to?: Date;
  search?: string;
  category?: string;
}

export function buildLedgerWhere(tenantId: string, filters: LedgerFilters): Prisma.StockLedgerWhereInput {
  return {
    tenantId,
    ...(filters.partId ? { partId: filters.partId } : {}),
    ...(filters.storeId ? { inventory: { storeId: filters.storeId } } : {}),
    ...(filters.category ? { part: { category: filters.category } } : {}),
    ...(filters.transactionType ? { transactionType: filters.transactionType as any } : {}),
    ...(filters.invoiceNumber ? { invoiceNumber: { contains: filters.invoiceNumber, mode: "insensitive" } } : {}),
    ...(filters.transactionNumber
      ? { transactionNumber: { contains: filters.transactionNumber, mode: "insensitive" } }
      : {}),
    ...(filters.from || filters.to ? { createdAt: { gte: filters.from, lte: filters.to } } : {}),
    ...(filters.search
      ? {
          OR: [
            { transactionNumber: { contains: filters.search, mode: "insensitive" } },
            { invoiceNumber: { contains: filters.search, mode: "insensitive" } },
            { part: { partNo: { contains: filters.search, mode: "insensitive" } } },
            { part: { description: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

export async function listLedger(tenantId: string, filters: LedgerFilters, page: number, pageSize: number) {
  const where = buildLedgerWhere(tenantId, filters);
  const [rows, total] = await Promise.all([
    prisma.stockLedger.findMany({
      where,
      include: {
        part: { select: { partNo: true, description: true, unit: true, category: true } },
        inventory: { include: { store: true, bin: true, rack: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockLedger.count({ where }),
  ]);
  // quantityChange/balanceQuantity are Decimal(12,3) in the DB (fractional
  // ML/KGS support) — Number()-converted here so the API keeps returning
  // plain numbers, matching every existing frontend consumer.
  const items = rows.map((r) => ({ ...r, quantityChange: Number(r.quantityChange), balanceQuantity: Number(r.balanceQuantity) }));
  return buildPageResult(items, total, page, pageSize);
}

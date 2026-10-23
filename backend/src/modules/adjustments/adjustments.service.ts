import type { Request } from "express";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { nextSequenceNumber } from "../../lib/numberSequence";
import { getOrCreateLockedInventory, applyInventoryDelta } from "../inventory/inventory.mutations";
import { recordAudit } from "../audit/audit.service";
import { buildPageResult } from "../../utils/pagination";
import { isValidQuantityForUnit } from "../../utils/quantity";
import type { CreateAdjustmentInput } from "./adjustments.schema";

export async function createAdjustment(tenantId: string, userId: string, input: CreateAdjustmentInput, req?: Request) {
  // Explicit timeout so this transaction's ~6-7 sequential round trips
  // don't get killed by Prisma's 5s default over a serverless-pooled
  // connection — see returns.service.ts for the incident this mirrors.
  const result = await prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.findFirst({ where: { id: input.inventoryId, tenantId }, include: { part: true } });
    if (!inventory) throw ApiError.notFound("Selected stock location not found");

    if (!isValidQuantityForUnit(input.physicalQuantity, inventory.part.unit)) {
      throw ApiError.unprocessable(
        `Physical Quantity must be a whole number for parts measured in ${inventory.part.unit} (only ML, LTR and KGS allow decimal quantities).`,
        "FRACTIONAL_QUANTITY_NOT_ALLOWED"
      );
    }

    const locked = await getOrCreateLockedInventory(
      tx,
      tenantId,
      inventory.partId,
      inventory.storeId,
      inventory.binId,
      inventory.rackId
    );

    const difference = input.physicalQuantity - locked.quantity;
    const adjustmentNumber = await nextSequenceNumber(tx, tenantId, "ADJ");

    const adjustment = await tx.stockAdjustment.create({
      data: {
        tenantId,
        adjustmentNumber,
        partId: inventory.partId,
        inventoryId: inventory.id,
        systemQuantity: locked.quantity,
        physicalQuantity: input.physicalQuantity,
        difference,
        reasonType: input.reasonType,
        remarks: input.remarks,
        createdById: userId,
      },
    });

    const newBalance = await applyInventoryDelta(tx, locked.id, locked.quantity, difference);

    const user = await tx.user.findUnique({ where: { id: userId } });
    await tx.stockLedger.create({
      data: {
        tenantId,
        transactionType: "ADJUSTMENT",
        transactionNumber: adjustmentNumber,
        partId: inventory.partId,
        inventoryId: inventory.id,
        quantityChange: difference,
        balanceQuantity: newBalance,
        reference: input.reasonType,
        adjustmentId: adjustment.id,
        createdById: userId,
        createdByName: user ? `${user.firstName} ${user.lastName}` : "",
      },
    });

    return adjustment;
  }, { timeout: 30_000 });

  await recordAudit({
    req,
    tenantId,
    userId,
    action: "ADJUSTMENT_CREATED",
    entityType: "StockAdjustment",
    entityId: result.id,
    newValue: {
      adjustmentNumber: result.adjustmentNumber,
      systemQuantity: Number(result.systemQuantity),
      physicalQuantity: Number(result.physicalQuantity),
      difference: Number(result.difference),
      reasonType: result.reasonType,
    },
  });

  await prisma.notification.create({
    data: {
      tenantId,
      userId,
      type: "ADJUSTMENT_SUCCESS",
      title: "Stock adjustment completed",
      message: `Adjustment ${result.adjustmentNumber} recorded (difference: ${Number(result.difference)}).`,
    },
  });

  const created = await prisma.stockAdjustment.findUnique({ where: { id: result.id }, include: { part: true, inventory: { include: { store: true, bin: true, rack: true } } } });
  return created ? mapAdjustmentQuantities(created) : created;
}

/** systemQuantity/physicalQuantity/difference are Decimal(12,3) in the DB (fractional ML/KGS support) — Number()-converted so the API keeps returning plain numbers, matching the existing frontend contract. */
function mapAdjustmentQuantities<T extends { systemQuantity: unknown; physicalQuantity: unknown; difference: unknown }>(adj: T) {
  return { ...adj, systemQuantity: Number(adj.systemQuantity), physicalQuantity: Number(adj.physicalQuantity), difference: Number(adj.difference) };
}

export async function listAdjustments(tenantId: string, page: number, pageSize: number, search?: string) {
  const where = {
    tenantId,
    ...(search ? { adjustmentNumber: { contains: search, mode: "insensitive" as const } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.stockAdjustment.findMany({
      where,
      include: { part: true, inventory: { include: { store: true, bin: true, rack: true } }, createdBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockAdjustment.count({ where }),
  ]);
  return buildPageResult(rows.map(mapAdjustmentQuantities), total, page, pageSize);
}

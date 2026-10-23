import type { Request } from "express";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { nextSequenceNumber } from "../../lib/numberSequence";
import { getOrCreateLockedInventory, applyInventoryDelta } from "../inventory/inventory.mutations";
import { recordAudit } from "../audit/audit.service";
import { buildPageResult } from "../../utils/pagination";
import { isValidQuantityForUnit } from "../../utils/quantity";
import type { CreateIssueInput } from "./issues.schema";

export async function createIssue(tenantId: string, userId: string, input: CreateIssueInput, req?: Request) {
  // Explicit timeout so this transaction's several sequential round trips
  // don't get killed by Prisma's 5s default over a serverless-pooled
  // connection — see returns.service.ts for the incident this mirrors.
  const result = await prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.findFirst({
      where: { id: input.inventoryId, tenantId },
      include: { part: true },
    });
    if (!inventory) throw ApiError.notFound("Selected stock location not found");

    if (Number(inventory.quantity) <= 0) {
      throw ApiError.unprocessable("This part is currently out of stock.", "OUT_OF_STOCK");
    }

    if (!isValidQuantityForUnit(input.quantity, inventory.part.unit)) {
      throw ApiError.unprocessable(
        `Quantity must be a whole number for parts measured in ${inventory.part.unit} (only ML, LTR and KGS allow decimal quantities).`,
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

    const issueNumber = await nextSequenceNumber(tx, tenantId, "ISS");

    const issue = await tx.issue.create({
      data: {
        tenantId,
        issueNumber,
        reference: input.reference,
        remarks: input.remarks,
        status: "ISSUED",
        createdById: userId,
        items: {
          create: {
            partId: inventory.partId,
            inventoryId: inventory.id,
            quantity: input.quantity,
            mrp: inventory.part.mrp,
            ndp: inventory.part.ndp,
            taxPercent: inventory.part.taxPercent,
          },
        },
      },
      include: { items: true },
    });

    const newBalance = await applyInventoryDelta(tx, locked.id, locked.quantity, -input.quantity);

    const user = await tx.user.findUnique({ where: { id: userId } });

    await tx.stockLedger.create({
      data: {
        tenantId,
        transactionType: "ISSUE",
        transactionNumber: issueNumber,
        partId: inventory.partId,
        inventoryId: inventory.id,
        quantityChange: -input.quantity,
        balanceQuantity: newBalance,
        reference: input.reference,
        issueId: issue.id,
        createdById: userId,
        createdByName: user ? `${user.firstName} ${user.lastName}` : "",
      },
    });

    return issue;
  }, { timeout: 30_000 });

  await recordAudit({
    req,
    tenantId,
    userId,
    action: "ISSUE_CREATED",
    entityType: "Issue",
    entityId: result.id,
    newValue: { issueNumber: result.issueNumber, quantity: input.quantity },
  });

  await prisma.notification.create({
    data: {
      tenantId,
      userId,
      type: "ISSUE_SUCCESS",
      title: "Part issued",
      message: `Issue ${result.issueNumber} created successfully.`,
    },
  });

  return getIssue(tenantId, result.id);
}

/** quantity/returnedQty are Decimal(12,3) in the DB (fractional ML/KGS support) — Number()-converted so the API keeps returning plain numbers, matching the existing frontend contract. */
function mapIssueQuantities<T extends { items: Array<{ quantity: unknown; returnedQty: unknown }> }>(issue: T) {
  return { ...issue, items: issue.items.map((item) => ({ ...item, quantity: Number(item.quantity), returnedQty: Number(item.returnedQty) })) };
}

export async function listIssues(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string; status?: string; storeId?: string }
) {
  const where = {
    tenantId,
    ...(opts.status ? { status: opts.status as any } : {}),
    ...(opts.search
      ? {
          OR: [
            { issueNumber: { contains: opts.search, mode: "insensitive" as const } },
            { reference: { contains: opts.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(opts.storeId ? { items: { some: { inventory: { storeId: opts.storeId } } } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.issue.findMany({
      where,
      include: {
        items: { include: { part: true, inventory: { include: { store: true, bin: true, rack: true } } } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.issue.count({ where }),
  ]);

  return buildPageResult(rows.map(mapIssueQuantities), total, opts.page, opts.pageSize);
}

export async function getIssue(tenantId: string, id: string) {
  const issue = await prisma.issue.findFirst({
    where: { id, tenantId },
    include: {
      items: { include: { part: true, inventory: { include: { store: true, bin: true, rack: true } } } },
      createdBy: { select: { firstName: true, lastName: true, email: true } },
      returns: { include: { items: true } },
      tenant: { select: { name: true, dealerCode: true, address: true, phone: true, email: true, gstin: true } },
    },
  });
  if (!issue) throw ApiError.notFound("Issue not found");
  return mapIssueQuantities(issue);
}

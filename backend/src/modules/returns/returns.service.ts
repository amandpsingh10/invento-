import type { Request } from "express";
import type { Prisma } from "@parts-inventory-system/database";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { nextSequenceNumber } from "../../lib/numberSequence";
import { getOrCreateLockedInventory, applyInventoryDelta } from "../inventory/inventory.mutations";
import { recordAudit } from "../audit/audit.service";
import { buildPageResult } from "../../utils/pagination";
import { isValidQuantityForUnit } from "../../utils/quantity";
import type { CreateReturnInput } from "./returns.schema";

type Tx = Prisma.TransactionClient;

/** Looks up an Issue by number and returns per-item remaining-returnable quantities, for the Return Part screen. */
export async function getReturnableIssue(tenantId: string, issueNumber: string) {
  const issue = await prisma.issue.findFirst({
    where: { tenantId, issueNumber },
    include: {
      items: { include: { part: true, inventory: { include: { store: true, bin: true, rack: true } } } },
    },
  });
  if (!issue) throw ApiError.notFound(`Issue "${issueNumber}" not found`);

  return {
    kind: "ISSUE" as const,
    id: issue.id,
    number: issue.issueNumber,
    date: issue.issueDate,
    reference: issue.reference,
    status: issue.status,
    requiresCancellationFirst: false,
    items: issue.items.map((item) => ({
      id: item.id,
      kind: "ISSUE_ITEM" as const,
      partId: item.partId,
      partNo: item.part.partNo,
      description: item.part.description,
      unit: item.part.unit,
      category: item.part.category,
      store: item.inventory.store,
      bin: item.inventory.bin,
      rack: item.inventory.rack,
      originalQty: Number(item.quantity),
      alreadyReturnedQty: Number(item.returnedQty),
      remainingReturnableQty: Number(item.quantity) - Number(item.returnedQty),
    })),
  };
}

/**
 * Looks up a customer sale by Invoice No for the Return Part screen.
 * Scenario 2 from the spec: while the invoice is still COMPLETED, every
 * item is reported as non-returnable (requiresCancellationFirst: true) —
 * the frontend shows "Invoice must be cancelled before returning the
 * part." and a Cancel Invoice action instead of a return quantity input.
 * Once the invoice is CANCELLED, its items become returnable exactly like
 * an Issue's.
 */
export async function getReturnableInvoice(tenantId: string, invoiceNumber: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { tenantId, invoiceNumber },
    include: {
      customer: true,
      items: { include: { part: true, inventory: { include: { store: true, bin: true, rack: true } } } },
    },
  });
  if (!invoice) throw ApiError.notFound(`Invoice "${invoiceNumber}" not found`);

  const requiresCancellationFirst = invoice.status === "COMPLETED";

  return {
    kind: "INVOICE" as const,
    id: invoice.id,
    number: invoice.invoiceNumber,
    date: invoice.invoiceDate,
    reference: `${invoice.customer.name} — ${invoice.customer.mobile}`,
    status: invoice.status,
    requiresCancellationFirst,
    items: invoice.items.map((item) => ({
      id: item.id,
      kind: "INVOICE_ITEM" as const,
      partId: item.partId,
      partNo: item.part.partNo,
      description: item.part.description,
      unit: item.part.unit,
      category: item.part.category,
      store: item.inventory.store,
      bin: item.inventory.bin,
      rack: item.inventory.rack,
      originalQty: Number(item.quantity),
      alreadyReturnedQty: Number(item.returnedQty),
      remainingReturnableQty: requiresCancellationFirst ? 0 : Number(item.quantity) - Number(item.returnedQty),
    })),
  };
}

/**
 * Backs the Return Part screen's single search box ("Search Invoice No /
 * Sale No / Customer Mobile"): matches partially against Issue numbers and
 * against Invoice number / customer name / customer mobile, returning a
 * short unified list for the user to pick from before drilling into the
 * specific lookup (getReturnableIssue / getReturnableInvoice).
 */
export async function searchReturnables(tenantId: string, query: string) {
  const [issues, invoices] = await Promise.all([
    prisma.issue.findMany({
      where: { tenantId, issueNumber: { contains: query, mode: "insensitive" } },
      select: { issueNumber: true, issueDate: true, reference: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.invoice.findMany({
      where: {
        tenantId,
        OR: [
          { invoiceNumber: { contains: query, mode: "insensitive" } },
          { customer: { name: { contains: query, mode: "insensitive" } } },
          { customer: { mobile: { contains: query, mode: "insensitive" } } },
        ],
      },
      select: { invoiceNumber: true, invoiceDate: true, status: true, customer: { select: { name: true, mobile: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return [
    ...issues.map((i) => ({
      kind: "ISSUE" as const,
      number: i.issueNumber,
      date: i.issueDate,
      label: i.reference ?? "Part Issue",
      status: i.status,
    })),
    ...invoices.map((i) => ({
      kind: "INVOICE" as const,
      number: i.invoiceNumber,
      date: i.invoiceDate,
      label: `${i.customer.name} — ${i.customer.mobile}`,
      status: i.status,
    })),
  ];
}

export async function createReturn(tenantId: string, userId: string, input: CreateReturnInput, req?: Request) {
  // This transaction makes ~8-10 sequential round trips (item lookup, row
  // lock, sequence number, return + item creation, issue/invoice item
  // update, inventory update, user lookup, ledger entry). Against Neon's
  // pooled connection, Prisma's default 5s interactive-transaction timeout
  // can expire mid-flight, aborting the transaction with a stale-handle
  // error ("Transaction not found... obtained before disconnecting") even
  // though every individual query is healthy. createSale (sales.service.ts)
  // hits the same shape of problem and is already given headroom the same
  // way — match it here.
  const result = await prisma.$transaction(
    async (tx) => {
      if (input.issueItemId) {
        return createReturnFromIssueItem(tx, tenantId, userId, input.issueItemId, input.quantity, input.remarks);
      }
      return createReturnFromInvoiceItem(tx, tenantId, userId, input.invoiceItemId!, input.quantity, input.remarks);
    },
    { timeout: 30_000 }
  );

  await recordAudit({
    req,
    tenantId,
    userId,
    action: "RETURN_CREATED",
    entityType: "Return",
    entityId: result.id,
    newValue: { returnNumber: result.returnNumber, quantity: input.quantity },
  });

  await prisma.notification.create({
    data: {
      tenantId,
      userId,
      type: "RETURN_SUCCESS",
      title: "Part returned",
      message: `${input.quantity} part(s) returned to inventory (${result.returnNumber}).`,
    },
  });

  return getReturn(tenantId, result.id);
}

async function createReturnFromIssueItem(
  tx: Tx,
  tenantId: string,
  userId: string,
  issueItemId: string,
  quantity: number,
  remarks: string | undefined
) {
  const issueItem = await tx.issueItem.findFirst({
    where: { id: issueItemId, issue: { tenantId } },
    include: { issue: true, inventory: true, part: true },
  });
  if (!issueItem) throw ApiError.notFound("Issued item not found");

  if (!isValidQuantityForUnit(quantity, issueItem.part.unit)) {
    throw ApiError.unprocessable(
      `Return quantity must be a whole number for parts measured in ${issueItem.part.unit} (only ML, LTR and KGS allow decimal quantities).`,
      "FRACTIONAL_QUANTITY_NOT_ALLOWED"
    );
  }

  const remaining = Number(issueItem.quantity) - Number(issueItem.returnedQty);
  if (remaining <= 0) {
    throw ApiError.unprocessable("No quantity available for return.", "OVER_RETURN");
  }
  if (quantity > remaining) {
    throw ApiError.unprocessable(`Return quantity cannot exceed the remaining returnable quantity of ${remaining}.`, "OVER_RETURN");
  }

  const locked = await getOrCreateLockedInventory(
    tx,
    tenantId,
    issueItem.partId,
    issueItem.inventory.storeId,
    issueItem.inventory.binId,
    issueItem.inventory.rackId
  );

  const returnNumber = await nextSequenceNumber(tx, tenantId, "RET");

  const ret = await tx.return.create({
    data: {
      tenantId,
      returnNumber,
      issueId: issueItem.issueId,
      remarks,
      createdById: userId,
      items: {
        create: {
          issueItemId: issueItem.id,
          partId: issueItem.partId,
          inventoryId: issueItem.inventoryId,
          quantity,
        },
      },
    },
  });

  await tx.issueItem.update({ where: { id: issueItem.id }, data: { returnedQty: { increment: quantity } } });

  const siblingItems = await tx.issueItem.findMany({ where: { issueId: issueItem.issueId } });
  // Decimal fields must be explicitly Number()-converted before arithmetic
  // — `Decimal + Number` in JS does STRING CONCATENATION (Decimal.valueOf()
  // returns a string, so `+` falls back to its string-concat branch), and
  // the resulting ">=" then compares two strings lexicographically instead
  // of numerically. Implicit coercion is not safe here.
  const allReturned = siblingItems.every(
    (item) => Number(item.returnedQty) + (item.id === issueItem.id ? quantity : 0) >= Number(item.quantity)
  );
  await tx.issue.update({ where: { id: issueItem.issueId }, data: { status: allReturned ? "FULLY_RETURNED" : "PARTIALLY_RETURNED" } });

  const newBalance = await applyInventoryDelta(tx, locked.id, locked.quantity, quantity);

  const user = await tx.user.findUnique({ where: { id: userId } });
  await tx.stockLedger.create({
    data: {
      tenantId,
      transactionType: "RETURN",
      transactionNumber: returnNumber,
      partId: issueItem.partId,
      inventoryId: issueItem.inventoryId,
      quantityChange: quantity,
      balanceQuantity: newBalance,
      reference: issueItem.issue.issueNumber,
      returnId: ret.id,
      createdById: userId,
      createdByName: user ? `${user.firstName} ${user.lastName}` : "",
    },
  });

  return ret;
}

async function createReturnFromInvoiceItem(
  tx: Tx,
  tenantId: string,
  userId: string,
  invoiceItemId: string,
  quantity: number,
  remarks: string | undefined
) {
  const invoiceItem = await tx.invoiceItem.findFirst({
    where: { id: invoiceItemId, invoice: { tenantId } },
    include: { invoice: true, inventory: true, part: true },
  });
  if (!invoiceItem) throw ApiError.notFound("Invoice item not found");

  // The one rule this whole flow exists to enforce: a completed sale's
  // stock can never be silently returned — the invoice must be cancelled
  // first, which is its own explicit, audited step (see sales.service.ts).
  if (invoiceItem.invoice.status === "COMPLETED") {
    throw ApiError.unprocessable(
      "Invoice must be cancelled before returning the part.",
      "INVOICE_NOT_CANCELLED",
      { invoiceNumber: invoiceItem.invoice.invoiceNumber }
    );
  }
  if (invoiceItem.invoice.status === "DRAFT") {
    throw ApiError.unprocessable("Draft invoices cannot be returned against.", "INVOICE_NOT_CANCELLED");
  }

  if (!isValidQuantityForUnit(quantity, invoiceItem.part.unit)) {
    throw ApiError.unprocessable(
      `Return quantity must be a whole number for parts measured in ${invoiceItem.part.unit} (only ML, LTR and KGS allow decimal quantities).`,
      "FRACTIONAL_QUANTITY_NOT_ALLOWED"
    );
  }

  const remaining = Number(invoiceItem.quantity) - Number(invoiceItem.returnedQty);
  if (remaining <= 0) {
    throw ApiError.unprocessable("No quantity available for return.", "OVER_RETURN");
  }
  if (quantity > remaining) {
    throw ApiError.unprocessable(`Return quantity cannot exceed the remaining returnable quantity of ${remaining}.`, "OVER_RETURN");
  }

  const locked = await getOrCreateLockedInventory(
    tx,
    tenantId,
    invoiceItem.partId,
    invoiceItem.inventory.storeId,
    invoiceItem.inventory.binId,
    invoiceItem.inventory.rackId
  );

  const returnNumber = await nextSequenceNumber(tx, tenantId, "RET");

  const ret = await tx.return.create({
    data: {
      tenantId,
      returnNumber,
      invoiceId: invoiceItem.invoiceId,
      remarks,
      createdById: userId,
      items: {
        create: {
          invoiceItemId: invoiceItem.id,
          partId: invoiceItem.partId,
          inventoryId: invoiceItem.inventoryId,
          quantity,
        },
      },
    },
  });

  await tx.invoiceItem.update({ where: { id: invoiceItem.id }, data: { returnedQty: { increment: quantity } } });

  const newBalance = await applyInventoryDelta(tx, locked.id, locked.quantity, quantity);

  const user = await tx.user.findUnique({ where: { id: userId } });
  await tx.stockLedger.create({
    data: {
      tenantId,
      transactionType: "RETURN",
      transactionNumber: returnNumber,
      partId: invoiceItem.partId,
      inventoryId: invoiceItem.inventoryId,
      quantityChange: quantity,
      balanceQuantity: newBalance,
      reference: invoiceItem.invoice.invoiceNumber,
      returnId: ret.id,
      createdById: userId,
      createdByName: user ? `${user.firstName} ${user.lastName}` : "",
    },
  });

  return ret;
}

/** quantity is Decimal(12,3) in the DB (fractional ML/KGS support) — Number()-converted so the API keeps returning a plain number, matching the existing frontend contract. */
function mapReturnQuantities<T extends { items: Array<{ quantity: unknown }> }>(ret: T) {
  return { ...ret, items: ret.items.map((item) => ({ ...item, quantity: Number(item.quantity) })) };
}

export async function listReturns(tenantId: string, page: number, pageSize: number, search?: string) {
  const where = {
    tenantId,
    ...(search ? { returnNumber: { contains: search, mode: "insensitive" as const } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.return.findMany({
      where,
      include: {
        items: { include: { part: true } },
        issue: { select: { issueNumber: true } },
        invoice: { select: { invoiceNumber: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.return.count({ where }),
  ]);
  return buildPageResult(rows.map(mapReturnQuantities), total, page, pageSize);
}

export async function getReturn(tenantId: string, id: string) {
  const ret = await prisma.return.findFirst({
    where: { id, tenantId },
    include: {
      items: { include: { part: true } },
      issue: true,
      invoice: { include: { customer: true } },
      createdBy: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (!ret) throw ApiError.notFound("Return not found");
  return mapReturnQuantities(ret);
}

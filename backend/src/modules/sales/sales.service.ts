import type { Request } from "express";
import type { Prisma } from "@parts-inventory-system/database";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { nextSequenceNumber } from "../../lib/numberSequence";
import { getOrCreateLockedInventory, applyInventoryDelta } from "../inventory/inventory.mutations";
import { recordAudit } from "../audit/audit.service";
import { buildPageResult } from "../../utils/pagination";
import { isValidQuantityForUnit } from "../../utils/quantity";
import { splitTaxInclusiveAmount } from "../../utils/pricing";
import type { CreateSaleInput } from "./sales.schema";

/**
 * Finds the tenant's existing customer by mobile number, or creates one.
 * Never looks outside the caller's tenantId — the (tenantId, mobile)
 * unique constraint is what makes "reuse across visits, never across
 * dealers" hold at the database level, not just in this query.
 */
async function findOrCreateCustomer(tenantId: string, input: CreateSaleInput["customer"]) {
  return prisma.customer.upsert({
    where: { tenantId_mobile: { tenantId, mobile: input.mobile } },
    update: {
      name: input.name,
      address: input.address || null,
      pincode: input.pincode || null,
      state: input.state || null,
      city: input.city || null,
      gstin: input.gstin || null,
      email: input.email || null,
    },
    create: {
      tenantId,
      name: input.name,
      mobile: input.mobile,
      address: input.address || null,
      pincode: input.pincode || null,
      state: input.state || null,
      city: input.city || null,
      gstin: input.gstin || null,
      email: input.email || null,
    },
  });
}

/** Case/whitespace-insensitive state comparison — "Haryana" and "haryana " must count as the same state. */
export function normalizeState(state: string | null | undefined): string {
  return (state ?? "").trim().toLowerCase();
}

export async function createSale(tenantId: string, userId: string, input: CreateSaleInput, req?: Request) {
  const customer = await findOrCreateCustomer(tenantId, input.customer);

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { state: true } });
  // Intra-state (same state as the dealer) -> CGST+SGST, split evenly.
  // Inter-state (different state) -> IGST, the full amount on one line.
  // If either state is unknown, default to IGST — never silently assume
  // "same state" for a GST-liable line when we can't actually confirm it.
  const isIntraState =
    !!tenant.state && !!customer.state && normalizeState(tenant.state) === normalizeState(customer.state);

  const invoiceId = await prisma.$transaction(
    async (tx) => {
      const invoiceNumber = await nextSequenceNumber(tx, tenantId, "INV");

      let subtotal = 0;
      let taxAmount = 0;
      const itemsToCreate: Array<{
        partId: string;
        inventoryId: string;
        quantity: number;
        sellingPrice: number;
        taxPercent: number;
        taxAmount: number;
        taxType: string;
        cgstAmount: number;
        sgstAmount: number;
        igstAmount: number;
        lineTotal: number;
      }> = [];
      const ledgerEntries: Array<{ partId: string; inventoryId: string; quantityChange: number; balanceQuantity: number }> = [];

      for (const line of input.items) {
        const inventory = await tx.inventory.findFirst({ where: { id: line.inventoryId, tenantId }, include: { part: true } });
        if (!inventory) throw ApiError.notFound("Selected stock location not found");

        if (Number(inventory.quantity) <= 0) {
          throw ApiError.unprocessable(`${inventory.part.partNo} is currently out of stock.`, "OUT_OF_STOCK");
        }

        if (!isValidQuantityForUnit(line.quantity, inventory.part.unit)) {
          throw ApiError.unprocessable(
            `Sale quantity for ${inventory.part.partNo} must be a whole number — it's measured in ${inventory.part.unit} (only ML, LTR and KGS allow decimal quantities).`,
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

        if (line.quantity > locked.quantity) {
          throw ApiError.unprocessable(
            `Insufficient stock. Available quantity: ${locked.quantity}.`,
            "INSUFFICIENT_STOCK"
          );
        }

        // sellingPrice is tax-inclusive (it defaults to Part.mrp, and MRP is
        // always tax-inclusive — see utils/pricing.ts) — it's what the
        // customer actually pays per unit. So lineTotal is fixed at
        // sellingPrice × quantity, and the taxable value / tax amount are
        // extracted from within it rather than added on top (which would
        // silently charge tax twice). lineTax is the remainder after
        // rounding lineAmount, not an independent rounding, so the two
        // always reconcile exactly to lineTotal.
        const sellingPrice = line.sellingPrice ?? Number(inventory.part.mrp);
        const taxPercent = Number(inventory.part.taxPercent);
        const lineTotal = Math.round(sellingPrice * line.quantity * 100) / 100;
        const { taxableValue: lineAmount, taxAmount: lineTax } = splitTaxInclusiveAmount(lineTotal, taxPercent);

        // Split evenly for intra-state (CGST == SGST == half the tax rate
        // each); the full amount goes to IGST for inter-state — rounding
        // the half separately so cgst+sgst always reconciles exactly to
        // lineTax even when lineTax has an odd paisa.
        const cgstAmount = isIntraState ? Math.round((lineTax / 2) * 100) / 100 : 0;
        const sgstAmount = isIntraState ? Math.round((lineTax - cgstAmount) * 100) / 100 : 0;
        const igstAmount = isIntraState ? 0 : lineTax;

        subtotal += lineAmount;
        taxAmount += lineTax;

        itemsToCreate.push({
          partId: inventory.partId,
          inventoryId: inventory.id,
          quantity: line.quantity,
          sellingPrice,
          taxPercent,
          taxAmount: lineTax,
          taxType: isIntraState ? "CGST_SGST" : "IGST",
          cgstAmount,
          sgstAmount,
          igstAmount,
          lineTotal,
        });

        const newBalance = await applyInventoryDelta(tx, locked.id, locked.quantity, -line.quantity);
        ledgerEntries.push({
          partId: inventory.partId,
          inventoryId: inventory.id,
          quantityChange: -line.quantity,
          balanceQuantity: newBalance,
        });
      }

      subtotal = Math.round(subtotal * 100) / 100;
      taxAmount = Math.round(taxAmount * 100) / 100;
      const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          invoiceNumber,
          customerId: customer.id,
          status: "COMPLETED",
          subtotal,
          taxAmount,
          grandTotal,
          createdById: userId,
          items: { create: itemsToCreate },
        },
      });

      const user = await tx.user.findUnique({ where: { id: userId } });
      const createdByName = user ? `${user.firstName} ${user.lastName}` : "";

      for (const entry of ledgerEntries) {
        await tx.stockLedger.create({
          data: {
            tenantId,
            transactionType: "SALE",
            transactionNumber: invoiceNumber,
            partId: entry.partId,
            inventoryId: entry.inventoryId,
            quantityChange: entry.quantityChange,
            balanceQuantity: entry.balanceQuantity,
            reference: invoiceNumber,
            saleInvoiceId: invoice.id,
            createdById: userId,
            createdByName,
          },
        });
      }

      return invoice.id;
    },
    { timeout: 30_000 }
  );

  await recordAudit({
    req,
    tenantId,
    userId,
    action: "SALE_CREATED",
    entityType: "Invoice",
    entityId: invoiceId,
  });

  const invoice = await getInvoice(tenantId, invoiceId);

  await prisma.notification.create({
    data: {
      tenantId,
      userId,
      type: "SALE_SUCCESS",
      title: "Sale completed",
      message: `Invoice ${invoice.invoiceNumber} created for ${customer.name} — ${formatAmount(invoice.grandTotal)}.`,
    },
  });

  return invoice;
}

function formatAmount(value: unknown): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export async function cancelInvoice(tenantId: string, userId: string, invoiceId: string, reason: string, req?: Request) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!invoice) throw ApiError.notFound("Invoice not found");

  if (invoice.status === "CANCELLED") {
    throw ApiError.conflict(`Invoice ${invoice.invoiceNumber} is already cancelled.`, "ALREADY_CANCELLED");
  }

  // Deliberately does NOT touch inventory or the stock ledger here — stock
  // is restored only by an explicit Return transaction against this
  // invoice, so cancellation and physical stock return stay two separately
  // traceable events (see returns.service.ts).
  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "CANCELLED",
      cancelledById: userId,
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
  });

  await recordAudit({
    req,
    tenantId,
    userId,
    action: "INVOICE_CANCELLED",
    entityType: "Invoice",
    entityId: invoiceId,
    oldValue: { status: invoice.status },
    newValue: { status: "CANCELLED", reason },
  });

  await prisma.notification.create({
    data: {
      tenantId,
      userId,
      type: "INVOICE_CANCELLED",
      title: "Invoice cancelled",
      message: `Invoice ${invoice.invoiceNumber} cancelled successfully. Use Return Part to restore stock.`,
    },
  });

  return updated;
}

/** quantity/returnedQty are Decimal(12,3) in the DB (fractional ML/KGS support) — Number()-converted so the API keeps returning plain numbers, matching the existing frontend contract. */
function mapInvoiceQuantities<T extends { items: Array<{ quantity: unknown; returnedQty: unknown }> }>(invoice: T) {
  return { ...invoice, items: invoice.items.map((item) => ({ ...item, quantity: Number(item.quantity), returnedQty: Number(item.returnedQty) })) };
}

export async function listInvoices(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string; status?: string }
) {
  const where: Prisma.InvoiceWhereInput = {
    tenantId,
    ...(opts.status ? { status: opts.status as any } : {}),
    ...(opts.search
      ? {
          OR: [
            { invoiceNumber: { contains: opts.search, mode: "insensitive" } },
            { customer: { name: { contains: opts.search, mode: "insensitive" } } },
            { customer: { mobile: { contains: opts.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { customer: true, items: { include: { part: true } }, createdBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);

  return buildPageResult(rows.map(mapInvoiceQuantities), total, opts.page, opts.pageSize);
}

export async function getInvoice(tenantId: string, id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, tenantId },
    include: {
      customer: true,
      items: { include: { part: true, inventory: { include: { store: true, bin: true, rack: true } } } },
      createdBy: { select: { firstName: true, lastName: true, email: true } },
      cancelledBy: { select: { firstName: true, lastName: true } },
      tenant: { select: { name: true, dealerCode: true, address: true, phone: true, email: true, state: true, pincode: true, gstin: true } },
    },
  });
  if (!invoice) throw ApiError.notFound("Invoice not found");
  return mapInvoiceQuantities(invoice);
}

export async function getInvoiceByNumber(tenantId: string, invoiceNumber: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { tenantId, invoiceNumber },
    include: {
      customer: true,
      items: { include: { part: true, inventory: { include: { store: true, bin: true, rack: true } } } },
    },
  });
  if (!invoice) throw ApiError.notFound(`Invoice "${invoiceNumber}" not found`);
  return mapInvoiceQuantities(invoice);
}

import type { Request } from "express";
import { prisma } from "../../lib/prisma";
import { storage } from "../../lib/storage";
import { ApiError } from "../../lib/apiError";
import { nextSequenceNumber } from "../../lib/numberSequence";
import { recordAudit } from "../audit/audit.service";
import { getOrCreateLockedInventory, applyInventoryDelta } from "../inventory/inventory.mutations";
import { buildPageResult } from "../../utils/pagination";
import { calculateMRP } from "../../utils/pricing";
import { parsePurchaseExcel, MAX_EXCEL_ROWS, type ValidatedPurchaseRow } from "./purchases.excel";
import { validatePurchaseRows } from "./purchases.validation";

export interface UploadPreviewResult {
  uploadedFileId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ValidatedPurchaseRow[];
}

export interface ImportResult {
  purchases: Array<{ id: string; purchaseNumber: string; invoiceNumber: string; itemCount: number }>;
  importedRows: number;
  skippedRows: number;
}

export async function uploadAndPreview(
  tenantId: string,
  userId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  req?: Request
): Promise<UploadPreviewResult> {
  const parsedRows = await parsePurchaseExcel(file.buffer, MAX_EXCEL_ROWS).catch((e: Error) => {
    throw ApiError.badRequest(e.message, "EXCEL_PARSE_ERROR");
  });

  if (parsedRows.length === 0) {
    throw ApiError.badRequest("The uploaded file contains no data rows", "EXCEL_EMPTY");
  }

  const validated = await validatePurchaseRows(tenantId, parsedRows);

  const { storageKey } = await storage.put(file.buffer, file.originalname, file.mimetype);
  const uploadedFile = await prisma.uploadedFile.create({
    data: {
      tenantId,
      originalName: file.originalname,
      storageKey,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      purpose: "PURCHASE_IMPORT",
      uploadedById: userId,
    },
  });

  const validCount = validated.filter((r) => r.isValid).length;

  await recordAudit({
    req,
    tenantId,
    userId,
    action: "EXCEL_UPLOADED",
    entityType: "UploadedFile",
    entityId: uploadedFile.id,
    newValue: { originalName: file.originalname, totalRows: validated.length, validRows: validCount },
  });

  return {
    uploadedFileId: uploadedFile.id,
    totalRows: validated.length,
    validRows: validCount,
    invalidRows: validated.length - validCount,
    rows: validated,
  };
}

export async function reValidateUploadedFile(tenantId: string, uploadedFileId: string): Promise<ValidatedPurchaseRow[]> {
  const uploadedFile = await prisma.uploadedFile.findFirst({ where: { id: uploadedFileId, tenantId } });
  if (!uploadedFile) throw ApiError.notFound("Uploaded file not found");
  const buffer = await storage.get(uploadedFile.storageKey);
  const parsedRows = await parsePurchaseExcel(buffer, MAX_EXCEL_ROWS);
  return validatePurchaseRows(tenantId, parsedRows);
}

/**
 * The single transactional core behind BOTH the Excel import and the manual
 * "Add Part" entry form — one row (manual) or many rows grouped by Invoice
 * No (Excel) are validated the same way (see purchases.validation.ts) and
 * land through this exact same Purchase -> Part upsert -> Inventory ->
 * StockLedger path, so the two entry methods can never produce different
 * business records for the same input.
 */
async function importValidatedRows(
  tenantId: string,
  userId: string,
  validRows: ValidatedPurchaseRow[],
  uploadedFileId: string | null,
  req?: Request
): Promise<ImportResult["purchases"]> {
  const rowsByInvoice = new Map<string, ValidatedPurchaseRow[]>();
  for (const row of validRows) {
    const key = row.invoiceNo;
    if (!rowsByInvoice.has(key)) rowsByInvoice.set(key, []);
    rowsByInvoice.get(key)!.push(row);
  }

  const [stores, bins, racks] = await Promise.all([
    prisma.store.findMany({ where: { tenantId }, select: { id: true, code: true, name: true } }),
    prisma.bin.findMany({ where: { tenantId }, select: { id: true, code: true, storeId: true } }),
    prisma.rack.findMany({ where: { tenantId }, select: { id: true, code: true, storeId: true } }),
  ]);
  const findStore = (code: string) =>
    stores.find((s) => s.code.toLowerCase() === code.toLowerCase() || s.name.toLowerCase() === code.toLowerCase())!;
  const findBin = (storeId: string, code: string) =>
    bins.find((b) => b.storeId === storeId && b.code.toLowerCase() === code.toLowerCase())!;
  const findRack = (storeId: string, code: string) =>
    racks.find((r) => r.storeId === storeId && r.code.toLowerCase() === code.toLowerCase())!;

  const createdPurchases: ImportResult["purchases"] = [];

  await prisma.$transaction(
    async (tx) => {
      for (const [invoiceNo, rows] of rowsByInvoice) {
        const purchaseNumber = await nextSequenceNumber(tx, tenantId, "PUR");

        const purchase = await tx.purchase.create({
          data: {
            tenantId,
            purchaseNumber,
            invoiceNumber: invoiceNo,
            status: "IMPORTED",
            uploadedFileId: uploadedFileId ?? undefined,
            createdById: userId,
          },
        });

        for (const row of rows) {
          const store = findStore(row.storeCode);
          const bin = findBin(store.id, row.binCode);
          const rack = findRack(store.id, row.rackCode);

          const part = await tx.part.upsert({
            where: { tenantId_partNo: { tenantId, partNo: row.partNo } },
            update: {
              description: row.partDescription,
              taxPercent: row.taxPercent!,
              hsnCode: row.hsnCode,
              mrp: row.mrp!,
              ndp: row.ndp!,
              dealerMarginPercent: row.dealerMarginPercent ?? 0,
              unit: row.unit,
            },
            create: {
              tenantId,
              partNo: row.partNo,
              description: row.partDescription,
              taxPercent: row.taxPercent!,
              hsnCode: row.hsnCode,
              mrp: row.mrp!,
              ndp: row.ndp!,
              dealerMarginPercent: row.dealerMarginPercent ?? 0,
              unit: row.unit,
              status: "ACTIVE",
            },
          });

          const inv = await getOrCreateLockedInventory(tx, tenantId, part.id, store.id, bin.id, rack.id);

          await tx.purchaseItem.create({
            data: {
              purchaseId: purchase.id,
              partId: part.id,
              inventoryId: inv.id,
              quantity: row.quantity!,
              mrp: row.mrp!,
              ndp: row.ndp!,
              taxPercent: row.taxPercent!,
            },
          });

          const newBalance = await applyInventoryDelta(tx, inv.id, inv.quantity, row.quantity!);
          // keep subsequent rows in the same invoice against the same location consistent
          inv.quantity = newBalance;

          await tx.stockLedger.create({
            data: {
              tenantId,
              transactionType: "PURCHASE",
              transactionNumber: purchaseNumber,
              partId: part.id,
              inventoryId: inv.id,
              invoiceNumber: invoiceNo,
              quantityChange: row.quantity!,
              balanceQuantity: newBalance,
              purchaseId: purchase.id,
              createdById: userId,
              createdByName: "",
            },
          });
        }

        createdPurchases.push({ id: purchase.id, purchaseNumber, invoiceNumber: invoiceNo, itemCount: rows.length });
      }
    },
    { timeout: 60_000 }
  );

  // Backfill createdByName (kept out of the hot loop above to avoid an extra query per row)
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    await prisma.stockLedger.updateMany({
      where: { purchaseId: { in: createdPurchases.map((p) => p.id) }, createdByName: "" },
      data: { createdByName: `${user.firstName} ${user.lastName}` },
    });
  }

  await recordAudit({
    req,
    tenantId,
    userId,
    action: uploadedFileId ? "PURCHASE_CREATED" : "INVENTORY_ADDED",
    entityType: "Purchase",
    newValue: { purchases: createdPurchases, importedRows: validRows.length },
  });

  await prisma.notification.create({
    data: {
      tenantId,
      userId,
      type: "PURCHASE_SUCCESS",
      title: uploadedFileId ? "Purchase imported" : "Part added to inventory",
      message: `${validRows.length} row(s) imported across ${createdPurchases.length} invoice(s).`,
    },
  });

  return createdPurchases;
}

export async function importPurchase(tenantId: string, userId: string, uploadedFileId: string, req?: Request): Promise<ImportResult> {
  const revalidated = await reValidateUploadedFile(tenantId, uploadedFileId);
  const validRows = revalidated.filter((r) => r.isValid);

  if (validRows.length === 0) {
    throw ApiError.badRequest("No valid rows to import. Fix the errors and re-upload.", "NO_VALID_ROWS");
  }

  const purchases = await importValidatedRows(tenantId, userId, validRows, uploadedFileId, req);

  return {
    purchases,
    importedRows: validRows.length,
    skippedRows: revalidated.length - validRows.length,
  };
}

export interface ManualEntryInput {
  invoiceNo: string;
  partNo: string;
  partDescription: string;
  taxPercent: number;
  hsnCode: string;
  /** Entered by the user; List Price and MRP are derived from it server-side (see utils/pricing.ts). */
  ndp: number;
  /** Added on top of NDP to get List Price; MRP then adds tax on top of that. */
  dealerMarginPercent: number;
  /** NOS | LTR | ML | KGS — defaults to NOS if omitted. */
  unit?: string;
  quantity: number;
  storeCode: string;
  binCode: string;
  rackCode: string;
}

/**
 * Inventory → Add Part. Runs the exact same field validation
 * (validatePurchaseRows) and the exact same importValidatedRows transaction
 * as the Excel path — just with a single manually-typed row instead of a
 * parsed sheet, so "same Excel/manual data structure" holds by construction
 * rather than by convention.
 */
export async function importManualEntry(
  tenantId: string,
  userId: string,
  input: ManualEntryInput,
  req?: Request
): Promise<{ purchase: ImportResult["purchases"][number] }> {
  const mrp = calculateMRP(input.ndp, input.dealerMarginPercent, input.taxPercent);
  const [validated] = await validatePurchaseRows(tenantId, [{ rowNumber: 1, ...input, mrp, unit: input.unit ?? "" }]);

  if (!validated.isValid) {
    throw ApiError.unprocessable(validated.errors.join("; "), "VALIDATION_ERROR", { errors: validated.errors });
  }

  const [purchase] = await importValidatedRows(tenantId, userId, [validated], null, req);
  return { purchase };
}

/** quantity is Decimal(12,3) in the DB (fractional ML/KGS support) — Number()-converted so the API keeps returning a plain number, matching the existing frontend contract. */
function mapPurchaseQuantities<T extends { items: Array<{ quantity: unknown }> }>(purchase: T) {
  return { ...purchase, items: purchase.items.map((item) => ({ ...item, quantity: Number(item.quantity) })) };
}

export async function listPurchases(tenantId: string, page: number, pageSize: number, search?: string) {
  const where = {
    tenantId,
    ...(search
      ? { OR: [{ purchaseNumber: { contains: search, mode: "insensitive" as const } }, { invoiceNumber: { contains: search, mode: "insensitive" as const } }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: { items: true, createdBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchase.count({ where }),
  ]);
  return buildPageResult(rows.map(mapPurchaseQuantities), total, page, pageSize);
}

export async function getPurchase(tenantId: string, id: string) {
  const purchase = await prisma.purchase.findFirst({
    where: { id, tenantId },
    include: { items: { include: { part: true } }, createdBy: { select: { firstName: true, lastName: true, email: true } } },
  });
  if (!purchase) throw ApiError.notFound("Purchase not found");
  return mapPurchaseQuantities(purchase);
}

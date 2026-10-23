import type { Request } from "express";
import { Prisma } from "@parts-inventory-system/database";
import { prisma } from "../../lib/prisma";
import { storage } from "../../lib/storage";
import { ApiError } from "../../lib/apiError";
import { buildPageResult } from "../../utils/pagination";
import { calculateMRP } from "../../utils/pricing";
import { recordAudit } from "../audit/audit.service";
import { parsePartsExcel, MAX_EXCEL_ROWS, type ValidatedPartRow } from "./parts.excel";
import { validatePartRows } from "./parts.import.validation";
import type { z } from "zod";
import type { createPartSchema, updatePartSchema } from "./parts.schema";

export async function listParts(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string; status?: string; category?: string; sortBy?: string; sortDir?: "asc" | "desc" }
) {
  const where: Prisma.PartWhereInput = {
    tenantId,
    ...(opts.status ? { status: opts.status as any } : {}),
    ...(opts.category ? { category: opts.category } : {}),
    ...(opts.search
      ? {
          OR: [
            { partNo: { contains: opts.search, mode: "insensitive" } },
            { description: { contains: opts.search, mode: "insensitive" } },
            { barcode: { equals: opts.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const sortableFields = new Set(["partNo", "description", "mrp", "ndp", "createdAt"]);
  const sortBy = sortableFields.has(opts.sortBy ?? "") ? opts.sortBy! : "partNo";

  const [items, total] = await Promise.all([
    prisma.part.findMany({
      where,
      orderBy: { [sortBy]: opts.sortDir ?? "asc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.part.count({ where }),
  ]);

  return buildPageResult(items, total, opts.page, opts.pageSize);
}

export async function getPart(tenantId: string, id: string) {
  const part = await prisma.part.findFirst({ where: { id, tenantId } });
  if (!part) throw ApiError.notFound("Part not found");
  return part;
}

export async function createPart(tenantId: string, input: z.infer<typeof createPartSchema>) {
  const existing = await prisma.part.findUnique({ where: { tenantId_partNo: { tenantId, partNo: input.partNo } } });
  if (existing) throw ApiError.conflict(`Part No "${input.partNo}" already exists`, "DUPLICATE_PART_NO");
  const mrp = calculateMRP(input.ndp, input.dealerMarginPercent, input.taxPercent);
  return prisma.part.create({ data: { tenantId, ...input, mrp } });
}

export async function updatePart(tenantId: string, id: string, input: z.infer<typeof updatePartSchema>) {
  const current = await getPart(tenantId, id);
  if (input.partNo) {
    const existing = await prisma.part.findUnique({ where: { tenantId_partNo: { tenantId, partNo: input.partNo } } });
    if (existing && existing.id !== id) {
      throw ApiError.conflict(`Part No "${input.partNo}" already exists`, "DUPLICATE_PART_NO");
    }
  }

  const ndp = input.ndp ?? Number(current.ndp);
  const dealerMarginPercent = input.dealerMarginPercent ?? Number(current.dealerMarginPercent);
  const taxPercent = input.taxPercent ?? Number(current.taxPercent);
  // Only recompute MRP when a pricing input actually changed — the form
  // resubmits every field on any edit, and parts created before the
  // NDP-first rule have an MRP that can differ by a paisa from
  // NDP × margin × tax purely from rounding, which an unrelated edit
  // (say, a description fix) shouldn't silently shift.
  const pricingChanged =
    ndp !== Number(current.ndp) || dealerMarginPercent !== Number(current.dealerMarginPercent) || taxPercent !== Number(current.taxPercent);

  return prisma.part.update({
    where: { id },
    data: pricingChanged ? { ...input, mrp: calculateMRP(ndp, dealerMarginPercent, taxPercent) } : input,
  });
}

export interface PartsUploadPreviewResult {
  uploadedFileId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ValidatedPartRow[];
}

export interface PartsImportResult {
  createdCount: number;
  updatedCount: number;
  importedRows: number;
  skippedRows: number;
}

/**
 * Bulk "Add Parts by Excel" — pure master-data upsert, unlike Upload
 * Purchase: no Store/Bin/Rack/Quantity, no Purchase/Inventory/StockLedger
 * records created. Reuses the same UploadedFile staging table (a
 * different `purpose` value) so the preview → confirm-import flow matches
 * the purchase-upload UX exactly.
 */
export async function uploadPartsAndPreview(
  tenantId: string,
  userId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  req?: Request
): Promise<PartsUploadPreviewResult> {
  const parsedRows = await parsePartsExcel(file.buffer, MAX_EXCEL_ROWS).catch((e: Error) => {
    throw ApiError.badRequest(e.message, "EXCEL_PARSE_ERROR");
  });

  if (parsedRows.length === 0) {
    throw ApiError.badRequest("The uploaded file contains no data rows", "EXCEL_EMPTY");
  }

  const validated = validatePartRows(parsedRows);

  const { storageKey } = await storage.put(file.buffer, file.originalname, file.mimetype);
  const uploadedFile = await prisma.uploadedFile.create({
    data: {
      tenantId,
      originalName: file.originalname,
      storageKey,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      purpose: "PARTS_IMPORT",
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
    newValue: { originalName: file.originalname, totalRows: validated.length, validRows: validCount, purpose: "PARTS_IMPORT" },
  });

  return {
    uploadedFileId: uploadedFile.id,
    totalRows: validated.length,
    validRows: validCount,
    invalidRows: validated.length - validCount,
    rows: validated,
  };
}

export async function reValidateUploadedPartsFile(tenantId: string, uploadedFileId: string): Promise<ValidatedPartRow[]> {
  const uploadedFile = await prisma.uploadedFile.findFirst({ where: { id: uploadedFileId, tenantId, purpose: "PARTS_IMPORT" } });
  if (!uploadedFile) throw ApiError.notFound("Uploaded file not found");
  const buffer = await storage.get(uploadedFile.storageKey);
  const parsedRows = await parsePartsExcel(buffer, MAX_EXCEL_ROWS);
  return validatePartRows(parsedRows);
}

export async function importPartsFromUpload(tenantId: string, userId: string, uploadedFileId: string, req?: Request): Promise<PartsImportResult> {
  const revalidated = await reValidateUploadedPartsFile(tenantId, uploadedFileId);
  const validRows = revalidated.filter((r) => r.isValid);

  let createdCount = 0;
  let updatedCount = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const row of validRows) {
        const existing = await tx.part.findUnique({ where: { tenantId_partNo: { tenantId, partNo: row.partNo } } });
        const data = {
          description: row.partDescription,
          taxPercent: row.taxPercent!,
          hsnCode: row.hsnCode,
          mrp: row.mrp!,
          ndp: row.ndp!,
          // Excel supplies MRP and NDP is back-derived at zero margin, so a
          // margin saved earlier via the form no longer describes this row.
          dealerMarginPercent: 0,
          unit: row.unit,
          category: row.category,
          barcode: row.barcode || null,
          minimumStockLevel: row.minimumStockLevel,
          status: row.status as "ACTIVE" | "INACTIVE",
        };
        if (existing) {
          await tx.part.update({ where: { id: existing.id }, data });
          updatedCount += 1;
        } else {
          await tx.part.create({ data: { tenantId, partNo: row.partNo, ...data } });
          createdCount += 1;
        }
      }
    },
    { timeout: 30_000 }
  );

  await recordAudit({
    req,
    tenantId,
    userId,
    action: "PARTS_BULK_IMPORTED",
    entityType: "UploadedFile",
    entityId: uploadedFileId,
    newValue: { createdCount, updatedCount, totalRows: revalidated.length },
  });

  if (createdCount > 0) {
    await prisma.notification.create({
      data: {
        tenantId,
        userId,
        type: "PART_ADDED",
        title: "New parts added",
        message: `${createdCount} new part${createdCount === 1 ? "" : "s"} added via bulk upload${updatedCount > 0 ? ` (${updatedCount} existing updated)` : ""}.`,
      },
    });
  }

  return { createdCount, updatedCount, importedRows: validRows.length, skippedRows: revalidated.length - validRows.length };
}

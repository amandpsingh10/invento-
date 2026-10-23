import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.middleware";
import { excelUpload } from "../../middleware/upload.middleware";
import { ApiError } from "../../lib/apiError";
import { createPartSchema, updatePartSchema } from "./parts.schema";
import { paginationSchema } from "../../utils/pagination";
import * as partsService from "./parts.service";
import { buildPartsTemplate, buildPartsErrorReportExcel } from "./parts.excel";
import { recordAudit } from "../audit/audit.service";
import { prisma } from "../../lib/prisma";

const router = Router();
router.use(requireAuth, requireTenant);

// Bulk "Add Parts by Excel" — registered ahead of the generic /:id routes
// below so Express doesn't try to match "template"/"upload"/"import" as a
// Part id first.
router.get(
  "/template",
  asyncHandler(async (_req, res) => {
    const buffer = await buildPartsTemplate();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="PARTS-INVENTORY-SYSTEM-Parts-Upload-Template.xlsx"');
    res.send(buffer);
  })
);

router.post(
  "/upload",
  requireRole(...ROLE_GROUPS.canManageMasters),
  excelUpload.single("file"),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    if (!req.file) throw ApiError.badRequest("No file uploaded", "FILE_REQUIRED");
    const result = await partsService.uploadPartsAndPreview(
      tenantId,
      req.user!.id,
      { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size },
      req
    );
    res.json({ success: true, data: result });
  })
);

router.get(
  "/upload/:uploadedFileId/error-report",
  requireRole(...ROLE_GROUPS.canManageMasters),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const rows = await partsService.reValidateUploadedPartsFile(tenantId, req.params.uploadedFileId);
    const buffer = await buildPartsErrorReportExcel(rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="PARTS-INVENTORY-SYSTEM-Rejected-Parts.xlsx"');
    res.send(buffer);
  })
);

const partsImportSchema = z.object({ uploadedFileId: z.string().uuid() });

router.post(
  "/import",
  requireRole(...ROLE_GROUPS.canManageMasters),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { uploadedFileId } = partsImportSchema.parse(req.body);
    const result = await partsService.importPartsFromUpload(tenantId, req.user!.id, uploadedFileId, req);
    res.status(201).json({ success: true, data: result });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const pagination = paginationSchema.parse(req.query);
    const result = await partsService.listParts(tenantId, {
      ...pagination,
      status: req.query.status as string | undefined,
      category: req.query.category as string | undefined,
    });
    res.json({ success: true, data: result });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const part = await partsService.getPart(tenantId, req.params.id);
    res.json({ success: true, data: part });
  })
);

router.post(
  "/",
  requireRole(...ROLE_GROUPS.canManageMasters),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = createPartSchema.parse(req.body);
    const part = await partsService.createPart(tenantId, input);
    await recordAudit({ req, tenantId, userId: req.user!.id, action: "PART_CREATED", entityType: "Part", entityId: part.id, newValue: input });
    await prisma.notification.create({
      data: {
        tenantId,
        userId: req.user!.id,
        type: "PART_ADDED",
        title: "New part added",
        message: `Part ${part.partNo} (${part.description}) added to the catalog.`,
      },
    });
    res.status(201).json({ success: true, data: part });
  })
);

router.put(
  "/:id",
  requireRole(...ROLE_GROUPS.canManageMasters),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = updatePartSchema.parse(req.body);
    const before = await partsService.getPart(tenantId, req.params.id);
    const part = await partsService.updatePart(tenantId, req.params.id, input);
    await recordAudit({ req, tenantId, userId: req.user!.id, action: "PART_UPDATED", entityType: "Part", entityId: part.id, oldValue: before, newValue: input });
    res.json({ success: true, data: part });
  })
);

export default router;

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.middleware";
import { excelUpload } from "../../middleware/upload.middleware";
import { ApiError } from "../../lib/apiError";
import * as purchasesService from "./purchases.service";
import { buildPurchaseTemplate, buildErrorReportExcel } from "./purchases.excel";
import { PART_UNITS, isValidQuantityForUnit } from "../../utils/quantity";

const router = Router();
router.use(requireAuth, requireTenant);

router.get(
  "/template",
  asyncHandler(async (_req, res) => {
    const buffer = await buildPurchaseTemplate();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="PARTS-INVENTORY-SYSTEM-Purchase-Upload-Template.xlsx"');
    res.send(buffer);
  })
);

router.post(
  "/upload",
  requireRole(...ROLE_GROUPS.canUploadPurchases),
  excelUpload.single("file"),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    if (!req.file) throw ApiError.badRequest("No file uploaded", "FILE_REQUIRED");
    const result = await purchasesService.uploadAndPreview(
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
  requireRole(...ROLE_GROUPS.canUploadPurchases),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const rows = await purchasesService.reValidateUploadedFile(tenantId, req.params.uploadedFileId);
    const buffer = await buildErrorReportExcel(rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="PARTS-INVENTORY-SYSTEM-Rejected-Rows.xlsx"');
    res.send(buffer);
  })
);

const importSchema = z.object({ uploadedFileId: z.string().uuid() });

router.post(
  "/import",
  requireRole(...ROLE_GROUPS.canUploadPurchases),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { uploadedFileId } = importSchema.parse(req.body);
    const result = await purchasesService.importPurchase(tenantId, req.user!.id, uploadedFileId, req);
    res.status(201).json({ success: true, data: result });
  })
);

export const manualEntrySchema = z.object({
  invoiceNo: z.string().min(1, "Invoice No is required"),
  partNo: z.string().min(1, "Part No is required"),
  partDescription: z.string().min(1, "Part Description is required"),
  taxPercent: z.coerce.number().min(0, "Tax % cannot be negative").max(100, "Tax % cannot exceed 100"),
  hsnCode: z.string().min(1, "HSN Code is required"),
  // Pricing is NDP-first: the user enters NDP (+ optional dealer margin %),
  // and the backend derives List Price and MRP from it (see
  // utils/pricing.ts). MRP is never accepted from the client.
  ndp: z.coerce.number().min(0, "NDP cannot be negative"),
  dealerMarginPercent: z.coerce.number().min(0, "Dealer margin % cannot be negative").max(500, "Dealer margin % cannot exceed 500").optional().default(0),
  unit: z.enum(PART_UNITS).default("NOS"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  storeCode: z.string().min(1, "Store is required"),
  binCode: z.string().min(1, "Bin is required"),
  rackCode: z.string().min(1, "Rack is required"),
}).refine((v) => isValidQuantityForUnit(v.quantity, v.unit), {
  message: "Quantity must be a whole number for this unit — only ML, LTR and KGS allow decimal quantities",
  path: ["quantity"],
});

router.post(
  "/manual",
  requireRole(...ROLE_GROUPS.canUploadPurchases),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = manualEntrySchema.parse(req.body);
    const result = await purchasesService.importManualEntry(tenantId, req.user!.id, input, req);
    res.status(201).json({ success: true, data: result });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const page = Number(req.query.page ?? 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 25), 100);
    const result = await purchasesService.listPurchases(tenantId, page, pageSize, req.query.search as string | undefined);
    res.json({ success: true, data: result });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const purchase = await purchasesService.getPurchase(tenantId, req.params.id);
    res.json({ success: true, data: purchase });
  })
);

export default router;

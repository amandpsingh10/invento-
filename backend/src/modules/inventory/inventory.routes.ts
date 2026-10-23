import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.middleware";
import { paginationSchema } from "../../utils/pagination";
import * as inventoryService from "./inventory.service";
import * as purchasesService from "../purchases/purchases.service";
import { manualEntrySchema } from "../purchases/purchases.routes";

const router = Router();
router.use(requireAuth, requireTenant);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const pagination = paginationSchema.parse(req.query);
    const result = await inventoryService.listCurrentStock(tenantId, {
      ...pagination,
      storeId: req.query.storeId as string | undefined,
      binId: req.query.binId as string | undefined,
      rackId: req.query.rackId as string | undefined,
      status: req.query.status as any,
    });
    res.json({ success: true, data: result });
  })
);

// Must be registered before "/:id" — otherwise Express would match this
// literal path against the ":id" param route instead.
router.get(
  "/low-stock",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const page = Number(req.query.page ?? 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 25), 100);
    const result = await inventoryService.listLowStock(tenantId, {
      page,
      pageSize,
      search: req.query.search as string | undefined,
      storeId: req.query.storeId as string | undefined,
    });
    res.json({ success: true, data: result });
  })
);

// Alias of POST /api/purchases/manual — same handler, same validation and
// import service, exposed under /api/inventory too per spec section 33.
router.post(
  "/manual-entry",
  requireRole(...ROLE_GROUPS.canUploadPurchases),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = manualEntrySchema.parse(req.body);
    const result = await purchasesService.importManualEntry(tenantId, req.user!.id, input, req);
    res.status(201).json({ success: true, data: result });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const inv = await inventoryService.getInventoryById(tenantId, req.params.id);
    res.json({ success: true, data: inv });
  })
);

router.get(
  "/:id/history",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const page = Number(req.query.page ?? 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 25), 100);
    const result = await inventoryService.getInventoryHistory(tenantId, req.params.id, page, pageSize);
    res.json({ success: true, data: result });
  })
);

export default router;

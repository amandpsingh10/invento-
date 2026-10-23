import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.middleware";
import { createAdjustmentSchema } from "./adjustments.schema";
import * as adjustmentsService from "./adjustments.service";

const router = Router();
router.use(requireAuth, requireTenant, requireRole(...ROLE_GROUPS.canAdjustStock));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const page = Number(req.query.page ?? 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 25), 100);
    const result = await adjustmentsService.listAdjustments(tenantId, page, pageSize, req.query.search as string | undefined);
    res.json({ success: true, data: result });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = createAdjustmentSchema.parse(req.body);
    const adjustment = await adjustmentsService.createAdjustment(tenantId, req.user!.id, input, req);
    res.status(201).json({ success: true, data: adjustment });
  })
);

export default router;

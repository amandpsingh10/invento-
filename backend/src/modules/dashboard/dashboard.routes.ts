import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { getDashboardSummary } from "./dashboard.service";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireTenant,
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await getDashboardSummary(tenantId);
    res.json({ success: true, data });
  })
);

export default router;

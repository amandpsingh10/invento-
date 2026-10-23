import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.middleware";
import { selectPlanSchema } from "./tenant.schema";
import * as tenantService from "./tenant.service";
import { recordAudit } from "../audit/audit.service";

const router = Router();
router.use(requireAuth, requireTenant);

// Any signed-in dealer user can see the paid tiers (the trial-expiry modal
// shows this list to everyone, even non-admins, so they know what their
// admin needs to pick) — only TENANT_ADMIN can act on them, below.
router.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    const plans = await tenantService.listSelectablePlans();
    res.json({ success: true, data: plans });
  })
);

router.post(
  "/select-plan",
  requireRole(...ROLE_GROUPS.canManageTenantSettings),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = selectPlanSchema.parse(req.body);
    const { tenant, plan } = await tenantService.selectPlan(tenantId, input);
    await recordAudit({
      req,
      tenantId,
      userId: req.user!.id,
      action: "PLAN_SELECTED",
      entityType: "Tenant",
      entityId: tenantId,
      newValue: { planCode: plan.code },
    });
    res.json({ success: true, data: { status: tenant.status, planCode: plan.code, planName: plan.name } });
  })
);

export default router;

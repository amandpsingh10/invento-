import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.middleware";
import { createRackSchema, updateRackSchema } from "./racks.schema";
import * as racksService from "./racks.service";
import { recordAudit } from "../audit/audit.service";

const router = Router();
router.use(requireAuth, requireTenant);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const racks = await racksService.listRacks(tenantId, req.query.storeId as string | undefined);
    res.json({ success: true, data: racks });
  })
);

router.post(
  "/",
  requireRole(...ROLE_GROUPS.canManageMasters),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = createRackSchema.parse(req.body);
    const rack = await racksService.createRack(tenantId, input);
    await recordAudit({ req, tenantId, userId: req.user!.id, action: "LOCATION_CREATED", entityType: "Rack", entityId: rack.id, newValue: input });
    res.status(201).json({ success: true, data: rack });
  })
);

router.put(
  "/:id",
  requireRole(...ROLE_GROUPS.canManageMasters),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = updateRackSchema.parse(req.body);
    const before = await racksService.getRack(tenantId, req.params.id);
    const rack = await racksService.updateRack(tenantId, req.params.id, input);
    await recordAudit({ req, tenantId, userId: req.user!.id, action: "LOCATION_UPDATED", entityType: "Rack", entityId: rack.id, oldValue: before, newValue: input });
    res.json({ success: true, data: rack });
  })
);

export default router;

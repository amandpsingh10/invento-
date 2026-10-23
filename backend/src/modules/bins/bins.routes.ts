import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.middleware";
import { createBinSchema, updateBinSchema } from "./bins.schema";
import * as binsService from "./bins.service";
import { recordAudit } from "../audit/audit.service";

const router = Router();
router.use(requireAuth, requireTenant);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const bins = await binsService.listBins(tenantId, req.query.storeId as string | undefined);
    res.json({ success: true, data: bins });
  })
);

router.post(
  "/",
  requireRole(...ROLE_GROUPS.canManageMasters),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = createBinSchema.parse(req.body);
    const bin = await binsService.createBin(tenantId, input);
    await recordAudit({ req, tenantId, userId: req.user!.id, action: "LOCATION_CREATED", entityType: "Bin", entityId: bin.id, newValue: input });
    res.status(201).json({ success: true, data: bin });
  })
);

router.put(
  "/:id",
  requireRole(...ROLE_GROUPS.canManageMasters),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = updateBinSchema.parse(req.body);
    const before = await binsService.getBin(tenantId, req.params.id);
    const bin = await binsService.updateBin(tenantId, req.params.id, input);
    await recordAudit({ req, tenantId, userId: req.user!.id, action: "LOCATION_UPDATED", entityType: "Bin", entityId: bin.id, oldValue: before, newValue: input });
    res.json({ success: true, data: bin });
  })
);

export default router;

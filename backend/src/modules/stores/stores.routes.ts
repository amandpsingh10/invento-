import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.middleware";
import { createStoreSchema, updateStoreSchema } from "./stores.schema";
import * as storesService from "./stores.service";
import { recordAudit } from "../audit/audit.service";

const router = Router();
router.use(requireAuth, requireTenant);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const stores = await storesService.listStores(tenantId, req.query.search as string | undefined);
    res.json({ success: true, data: stores });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const store = await storesService.getStore(tenantId, req.params.id);
    res.json({ success: true, data: store });
  })
);

router.post(
  "/",
  requireRole(...ROLE_GROUPS.canManageMasters),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = createStoreSchema.parse(req.body);
    const store = await storesService.createStore(tenantId, input);
    await recordAudit({ req, tenantId, userId: req.user!.id, action: "STORE_CREATED", entityType: "Store", entityId: store.id, newValue: input });
    res.status(201).json({ success: true, data: store });
  })
);

router.put(
  "/:id",
  requireRole(...ROLE_GROUPS.canManageMasters),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = updateStoreSchema.parse(req.body);
    const before = await storesService.getStore(tenantId, req.params.id);
    const store = await storesService.updateStore(tenantId, req.params.id, input);
    await recordAudit({ req, tenantId, userId: req.user!.id, action: "STORE_UPDATED", entityType: "Store", entityId: store.id, oldValue: before, newValue: input });
    res.json({ success: true, data: store });
  })
);

export default router;

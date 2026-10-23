import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.middleware";
import { createTenantSchema, updateTenantSchema, updatePlanSchema, updateMenuAccessSchema } from "./admin.schema";
import * as adminService from "./admin.service";
import { recordAudit } from "../audit/audit.service";

const router = Router();
router.use(requireAuth, requireRole(...ROLE_GROUPS.superAdminOnly));

router.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    const data = await adminService.platformDashboard();
    res.json({ success: true, data });
  })
);

router.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    const plans = await adminService.listPlans();
    res.json({ success: true, data: plans });
  })
);

router.put(
  "/plans/:id",
  asyncHandler(async (req, res) => {
    const input = updatePlanSchema.parse(req.body);
    const plan = await adminService.updatePlan(req.params.id, input);
    await recordAudit({ req, tenantId: null, userId: req.user!.id, action: "PLAN_UPDATED", entityType: "Plan", entityId: plan.id, newValue: input });
    res.json({ success: true, data: plan });
  })
);

router.get(
  "/tenants",
  asyncHandler(async (_req, res) => {
    const tenants = await adminService.listTenants();
    res.json({ success: true, data: tenants });
  })
);

router.get(
  "/tenants/:id",
  asyncHandler(async (req, res) => {
    const tenant = await adminService.getTenant(req.params.id);
    res.json({ success: true, data: tenant });
  })
);

router.post(
  "/tenants",
  asyncHandler(async (req, res) => {
    const input = createTenantSchema.parse(req.body);
    const tenant = await adminService.createTenant(input);
    await recordAudit({ req, tenantId: null, userId: req.user!.id, action: "TENANT_CREATED", entityType: "Tenant", entityId: tenant.id, newValue: { dealerCode: tenant.dealerCode, name: tenant.name } });
    res.status(201).json({ success: true, data: tenant });
  })
);

router.put(
  "/tenants/:id",
  asyncHandler(async (req, res) => {
    const input = updateTenantSchema.parse(req.body);
    const tenant = await adminService.updateTenant(req.params.id, input);
    await recordAudit({ req, tenantId: null, userId: req.user!.id, action: "TENANT_UPDATED", entityType: "Tenant", entityId: tenant.id, newValue: input });
    res.json({ success: true, data: tenant });
  })
);

router.put(
  "/tenants/:id/activate",
  asyncHandler(async (req, res) => {
    const tenant = await adminService.setTenantStatus(req.params.id, "ACTIVE");
    await recordAudit({ req, tenantId: null, userId: req.user!.id, action: "TENANT_ACTIVATED", entityType: "Tenant", entityId: tenant.id });
    res.json({ success: true, data: tenant });
  })
);

router.put(
  "/tenants/:id/deactivate",
  asyncHandler(async (req, res) => {
    const tenant = await adminService.setTenantStatus(req.params.id, "SUSPENDED");
    await recordAudit({ req, tenantId: null, userId: req.user!.id, action: "TENANT_SUSPENDED", entityType: "Tenant", entityId: tenant.id });
    res.json({ success: true, data: tenant });
  })
);

router.get(
  "/tenants/:id/users",
  asyncHandler(async (req, res) => {
    const users = await adminService.listTenantUsers(req.params.id);
    res.json({ success: true, data: users });
  })
);

router.get(
  "/users/:userId/menu-access",
  asyncHandler(async (req, res) => {
    const menuAccess = await adminService.getUserMenuAccess(req.params.userId);
    res.json({ success: true, data: menuAccess });
  })
);

router.put(
  "/users/:userId/menu-access",
  asyncHandler(async (req, res) => {
    const input = updateMenuAccessSchema.parse(req.body);
    const menuAccess = await adminService.setUserMenuAccess(req.params.userId, input.items);
    await recordAudit({ req, tenantId: null, userId: req.user!.id, action: "USER_MENU_ACCESS_UPDATED", entityType: "User", entityId: req.params.userId, newValue: input });
    res.json({ success: true, data: menuAccess });
  })
);

export default router;

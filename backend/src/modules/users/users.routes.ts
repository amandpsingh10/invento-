import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.middleware";
import { createUserSchema, updateUserSchema, resetUserPasswordSchema } from "./users.schema";
import * as usersService from "./users.service";
import { recordAudit } from "../audit/audit.service";

const router = Router();
router.use(requireAuth, requireTenant, requireRole(...ROLE_GROUPS.canManageUsers));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const users = await usersService.listUsers(tenantId);
    res.json({ success: true, data: users });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = createUserSchema.parse(req.body);
    const user = await usersService.createUser(tenantId, input);
    await recordAudit({ req, tenantId, userId: req.user!.id, action: "USER_CREATED", entityType: "User", entityId: user.id, newValue: { email: input.email, role: input.role } });
    res.status(201).json({ success: true, data: { id: user.id, email: user.email, mobile: user.mobile } });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = updateUserSchema.parse(req.body);
    const user = await usersService.updateUser(tenantId, req.params.id, input);
    await recordAudit({ req, tenantId, userId: req.user!.id, action: "USER_UPDATED", entityType: "User", entityId: user.id, newValue: input });
    res.json({ success: true, data: { id: user.id } });
  })
);

router.post(
  "/:id/reset-password",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = resetUserPasswordSchema.parse(req.body);
    const result = await usersService.resetUserPassword(tenantId, req.params.id, input);
    await recordAudit({ req, tenantId, userId: req.user!.id, action: "USER_PASSWORD_RESET", entityType: "User", entityId: req.params.id });
    res.json({ success: true, data: result });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    await usersService.deactivateUser(tenantId, req.params.id);
    await recordAudit({ req, tenantId, userId: req.user!.id, action: "USER_DEACTIVATED", entityType: "User", entityId: req.params.id });
    res.json({ success: true, data: { message: "User deactivated" } });
  })
);

export default router;

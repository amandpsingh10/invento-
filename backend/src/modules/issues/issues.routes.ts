import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.middleware";
import { createIssueSchema } from "./issues.schema";
import * as issuesService from "./issues.service";

const router = Router();
router.use(requireAuth, requireTenant);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const page = Number(req.query.page ?? 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 25), 100);
    const result = await issuesService.listIssues(tenantId, {
      page,
      pageSize,
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      storeId: req.query.storeId as string | undefined,
    });
    res.json({ success: true, data: result });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const issue = await issuesService.getIssue(tenantId, req.params.id);
    res.json({ success: true, data: issue });
  })
);

router.post(
  "/",
  requireRole(...ROLE_GROUPS.canIssueOrReturn),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = createIssueSchema.parse(req.body);
    const issue = await issuesService.createIssue(tenantId, req.user!.id, input, req);
    res.status(201).json({ success: true, data: issue });
  })
);

export default router;

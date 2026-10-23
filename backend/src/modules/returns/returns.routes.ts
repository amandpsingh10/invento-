import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.middleware";
import { createReturnSchema } from "./returns.schema";
import * as returnsService from "./returns.service";

const router = Router();
router.use(requireAuth, requireTenant);

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const q = (req.query.q as string | undefined)?.trim();
    if (!q) return res.json({ success: true, data: [] });
    const result = await returnsService.searchReturnables(tenantId, q);
    res.json({ success: true, data: result });
  })
);

router.get(
  "/lookup/:issueNumber",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const result = await returnsService.getReturnableIssue(tenantId, req.params.issueNumber);
    res.json({ success: true, data: result });
  })
);

router.get(
  "/lookup-invoice/:invoiceNumber",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const result = await returnsService.getReturnableInvoice(tenantId, req.params.invoiceNumber);
    res.json({ success: true, data: result });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const page = Number(req.query.page ?? 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 25), 100);
    const result = await returnsService.listReturns(tenantId, page, pageSize, req.query.search as string | undefined);
    res.json({ success: true, data: result });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const ret = await returnsService.getReturn(tenantId, req.params.id);
    res.json({ success: true, data: ret });
  })
);

router.post(
  "/",
  requireRole(...ROLE_GROUPS.canIssueOrReturn),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = createReturnSchema.parse(req.body);
    const ret = await returnsService.createReturn(tenantId, req.user!.id, input, req);
    res.status(201).json({ success: true, data: ret });
  })
);

export default router;

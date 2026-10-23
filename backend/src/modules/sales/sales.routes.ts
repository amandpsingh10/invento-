import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.middleware";
import { createSaleSchema, cancelInvoiceSchema } from "./sales.schema";
import * as salesService from "./sales.service";

const router = Router();
router.use(requireAuth, requireTenant);

router.get(
  "/",
  requireRole(...ROLE_GROUPS.canViewReports),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const page = Number(req.query.page ?? 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 25), 100);
    const result = await salesService.listInvoices(tenantId, {
      page,
      pageSize,
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
    });
    res.json({ success: true, data: result });
  })
);

router.post(
  "/",
  requireRole(...ROLE_GROUPS.canIssueOrReturn),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const input = createSaleSchema.parse(req.body);
    const invoice = await salesService.createSale(tenantId, req.user!.id, input, req);
    res.status(201).json({ success: true, data: invoice });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const invoice = await salesService.getInvoice(tenantId, req.params.id);
    res.json({ success: true, data: invoice });
  })
);

// Alias of GET /:id — kept as a distinct route per spec's API list so the
// printable-invoice view has a stable, self-describing URL to fetch from.
router.get(
  "/:id/print",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const invoice = await salesService.getInvoice(tenantId, req.params.id);
    res.json({ success: true, data: invoice });
  })
);

router.post(
  "/:id/cancel",
  requireRole(...ROLE_GROUPS.canAdjustStock),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { reason } = cancelInvoiceSchema.parse(req.body ?? {});
    const invoice = await salesService.cancelInvoice(tenantId, req.user!.id, req.params.id, reason, req);
    res.json({ success: true, data: invoice });
  })
);

export default router;

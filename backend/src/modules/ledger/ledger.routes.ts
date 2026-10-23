import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import * as ledgerService from "./ledger.service";

const router = Router();
router.use(requireAuth, requireTenant);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const page = Number(req.query.page ?? 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 25), 100);
    const result = await ledgerService.listLedger(
      tenantId,
      {
        partId: req.query.partId as string | undefined,
        storeId: req.query.storeId as string | undefined,
        category: req.query.category as string | undefined,
        transactionType: req.query.transactionType as string | undefined,
        invoiceNumber: req.query.invoiceNumber as string | undefined,
        transactionNumber: req.query.transactionNumber as string | undefined,
        from: req.query.from ? new Date(req.query.from as string) : undefined,
        to: req.query.to ? new Date(req.query.to as string) : undefined,
        search: req.query.search as string | undefined,
      },
      page,
      pageSize
    );
    res.json({ success: true, data: result });
  })
);

export default router;

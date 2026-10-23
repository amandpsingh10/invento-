import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.middleware";
import * as reportsService from "./reports.service";
import { exportToExcel } from "./reports.excel";

const router = Router();
router.use(requireAuth, requireTenant, requireRole(...ROLE_GROUPS.canViewReports));

function parseDateRange(req: any) {
  return {
    from: req.query.from ? new Date(req.query.from as string) : undefined,
    to: req.query.to ? new Date(req.query.to as string) : undefined,
  };
}
function parsePage(req: any) {
  return {
    page: Number(req.query.page ?? 1),
    pageSize: Math.min(Number(req.query.pageSize ?? 25), 500),
  };
}

router.get(
  "/stock",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { page, pageSize } = parsePage(req);
    const result = await reportsService.stockReport(
      tenantId,
      {
        ...parseDateRange(req),
        storeId: req.query.storeId as string | undefined,
        partId: req.query.partId as string | undefined,
        search: req.query.search as string | undefined,
        category: req.query.category as string | undefined,
      },
      page,
      pageSize
    );
    if (req.query.export === "excel") {
      const buffer = await exportToExcel(
        "Stock Report",
        [
          { header: "Part No", key: "partNo" },
          { header: "Description", key: "description", width: 30 },
          { header: "Unit", key: "unit" },
          { header: "Store", key: "store" },
          { header: "Bin", key: "bin" },
          { header: "Rack", key: "rack" },
          { header: "Opening", key: "opening" },
          { header: "Purchase", key: "purchase" },
          { header: "Issue", key: "issue" },
          { header: "Return", key: "return" },
          { header: "Adjustment", key: "adjustment" },
          { header: "Closing Stock", key: "closing" },
        ],
        result.items
      );
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="Stock-Report.xlsx"');
      return res.send(buffer);
    }
    res.json({ success: true, data: result });
  })
);

router.get(
  "/issues",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { page, pageSize } = parsePage(req);
    const result = await reportsService.issueReport(
      tenantId,
      { ...parseDateRange(req), storeId: req.query.storeId as string | undefined, category: req.query.category as string | undefined },
      page,
      pageSize
    );
    if (req.query.export === "excel") {
      const buffer = await exportToExcel(
        "Issue Report",
        [
          { header: "Issue No", key: "issueNumber" },
          { header: "Date", key: "issueDate" },
          { header: "Reference", key: "reference", width: 26 },
          { header: "Part No", key: "partNo" },
          { header: "Description", key: "description", width: 30 },
          { header: "Unit", key: "unit" },
          { header: "Store", key: "store" },
          { header: "Qty Issued", key: "quantity" },
          { header: "Qty Returned", key: "returnedQty" },
          { header: "Status", key: "status" },
          { header: "Created By", key: "createdBy" },
        ],
        result.items
      );
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="Issue-Report.xlsx"');
      return res.send(buffer);
    }
    res.json({ success: true, data: result });
  })
);

router.get(
  "/returns",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { page, pageSize } = parsePage(req);
    const result = await reportsService.returnReport(
      tenantId,
      { ...parseDateRange(req), category: req.query.category as string | undefined },
      page,
      pageSize
    );
    if (req.query.export === "excel") {
      const buffer = await exportToExcel(
        "Return Report",
        [
          { header: "Return No", key: "returnNumber" },
          { header: "Date", key: "returnDate" },
          { header: "Issue No", key: "issueNumber" },
          { header: "Part No", key: "partNo" },
          { header: "Description", key: "description", width: 30 },
          { header: "Unit", key: "unit" },
          { header: "Qty Returned", key: "quantity" },
          { header: "Created By", key: "createdBy" },
        ],
        result.items
      );
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="Return-Report.xlsx"');
      return res.send(buffer);
    }
    res.json({ success: true, data: result });
  })
);

router.get(
  "/transactions",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { page, pageSize } = parsePage(req);
    const result = await reportsService.transactionReport(
      tenantId,
      {
        ...parseDateRange(req),
        transactionType: req.query.transactionType as string | undefined,
        search: req.query.search as string | undefined,
        category: req.query.category as string | undefined,
      },
      page,
      pageSize
    );
    if (req.query.export === "excel") {
      const buffer = await exportToExcel(
        "Transaction Report",
        [
          { header: "Date", key: "createdAt" },
          { header: "Transaction No", key: "transactionNumber" },
          { header: "Type", key: "transactionType" },
          { header: "Invoice No", key: "invoiceNumber" },
          { header: "Part No", key: "partNo" },
          { header: "Unit", key: "unit" },
          { header: "Quantity Change", key: "quantityChange" },
          { header: "Balance", key: "balanceQuantity" },
          { header: "Created By", key: "createdByName" },
        ],
        result.items.map((i) => ({
          createdAt: i.createdAt,
          transactionNumber: i.transactionNumber,
          transactionType: i.transactionType,
          invoiceNumber: i.invoiceNumber,
          partNo: i.part.partNo,
          unit: i.part.unit,
          quantityChange: i.quantityChange,
          balanceQuantity: i.balanceQuantity,
          createdByName: i.createdByName,
        }))
      );
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="Transaction-Report.xlsx"');
      return res.send(buffer);
    }
    res.json({ success: true, data: result });
  })
);

export default router;

import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac.middleware";
import { listAuditLogs } from "./audit.service";
import { exportToExcel } from "../reports/reports.excel";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireTenant,
  requireRole(...ROLE_GROUPS.canManageUsers),
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const page = Number(req.query.page ?? 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 25), req.query.export === "excel" ? 5000 : 100);
    const result = await listAuditLogs(
      tenantId,
      {
        entityType: req.query.entityType as string | undefined,
        action: req.query.action as string | undefined,
        userId: req.query.userId as string | undefined,
        from: req.query.from ? new Date(req.query.from as string) : undefined,
        to: req.query.to ? new Date(req.query.to as string) : undefined,
      },
      page,
      pageSize
    );
    if (req.query.export === "excel") {
      const buffer = await exportToExcel(
        "Audit Log",
        [
          { header: "Action", key: "action", width: 24 },
          { header: "Timestamp", key: "createdAt", width: 20 },
          { header: "User", key: "userEmail", width: 26 },
          { header: "Role", key: "role", width: 18 },
          { header: "Entity", key: "entityType", width: 16 },
          { header: "IP Address", key: "ipAddress", width: 16 },
        ],
        result.items.map((log) => ({
          action: log.action,
          createdAt: log.createdAt,
          userEmail: log.userEmail ?? "System",
          role: log.role ?? "—",
          entityType: log.entityType,
          ipAddress: log.ipAddress ?? "—",
        }))
      );
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="Audit-Log.xlsx"');
      return res.send(buffer);
    }
    res.json({ success: true, data: result });
  })
);

export default router;

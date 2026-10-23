import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTenant, requireTenantId } from "../../middleware/tenant.middleware";
import { prisma } from "../../lib/prisma";

const router = Router();
router.use(requireAuth, requireTenant);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const notifications = await prisma.notification.findMany({
      where: { tenantId, OR: [{ userId: req.user!.id }, { userId: null }] },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unreadCount = await prisma.notification.count({
      where: { tenantId, OR: [{ userId: req.user!.id }, { userId: null }], isRead: false },
    });
    res.json({ success: true, data: { items: notifications, unreadCount } });
  })
);

router.put(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    const notification = await prisma.notification.findFirst({ where: { id: req.params.id, tenantId } });
    if (!notification) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Notification not found" } });
    await prisma.notification.update({ where: { id: notification.id }, data: { isRead: true } });
    res.json({ success: true, data: { message: "Marked as read" } });
  })
);

router.put(
  "/read-all",
  asyncHandler(async (req, res) => {
    const tenantId = requireTenantId(req);
    await prisma.notification.updateMany({
      where: { tenantId, OR: [{ userId: req.user!.id }, { userId: null }], isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, data: { message: "All notifications marked as read" } });
  })
);

export default router;

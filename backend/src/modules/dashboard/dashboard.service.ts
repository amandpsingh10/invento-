import { prisma } from "../../lib/prisma";
import { getDashboardStockCounts, computeStockStatus } from "../inventory/inventory.service";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getDashboardSummary(tenantId: string) {
  const today = startOfDay();
  const monthStart = startOfMonth();

  const [stockCounts, issuedToday, returnedToday, purchaseThisMonthAgg, recentLedger, topIssuedRaw, lowStockInventory] =
    await Promise.all([
      getDashboardStockCounts(tenantId),
      prisma.stockLedger.aggregate({
        where: { tenantId, transactionType: "ISSUE", createdAt: { gte: today } },
        _sum: { quantityChange: true },
      }),
      prisma.stockLedger.aggregate({
        where: { tenantId, transactionType: "RETURN", createdAt: { gte: today } },
        _sum: { quantityChange: true },
      }),
      prisma.stockLedger.aggregate({
        where: { tenantId, transactionType: "PURCHASE", createdAt: { gte: monthStart } },
        _sum: { quantityChange: true },
      }),
      prisma.stockLedger.findMany({
        where: { tenantId },
        include: { part: { select: { partNo: true, description: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.stockLedger.groupBy({
        by: ["partId"],
        where: { tenantId, transactionType: "ISSUE" },
        _sum: { quantityChange: true },
        orderBy: { _sum: { quantityChange: "asc" } }, // quantityChange is negative for issues
        take: 5,
      }),
      prisma.inventory.findMany({
        where: { tenantId },
        include: { part: true, store: { select: { name: true } } },
      }),
    ]);

  const topIssuedPartIds = topIssuedRaw.map((r) => r.partId);
  const topIssuedParts = await prisma.part.findMany({ where: { id: { in: topIssuedPartIds } } });
  const topIssued = topIssuedRaw.map((r) => {
    const part = topIssuedParts.find((p) => p.id === r.partId);
    return {
      partId: r.partId,
      partNo: part?.partNo ?? "",
      description: part?.description ?? "",
      quantityIssued: Math.abs(Number(r._sum.quantityChange ?? 0)),
    };
  });

  const lowStockParts = lowStockInventory
    .map((inv) => ({
      partNo: inv.part.partNo,
      description: inv.part.description,
      store: inv.store.name,
      availableQty: Number(inv.quantity),
      minimumStockLevel: inv.part.minimumStockLevel,
      status: computeStockStatus(Number(inv.quantity), inv.part.minimumStockLevel),
    }))
    .filter((r) => r.status !== "IN_STOCK")
    .sort((a, b) => a.availableQty - b.availableQty)
    .slice(0, 10);

  // Last 14 days of stock movement (purchase / issue / return) for the chart
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
  fourteenDaysAgo.setHours(0, 0, 0, 0);
  const movementRows = await prisma.stockLedger.findMany({
    where: { tenantId, createdAt: { gte: fourteenDaysAgo } },
    select: { createdAt: true, transactionType: true, quantityChange: true },
  });

  const movementByDay = new Map<string, { purchase: number; issue: number; return: number; adjustment: number }>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(fourteenDaysAgo);
    d.setDate(d.getDate() + i);
    movementByDay.set(d.toISOString().slice(0, 10), { purchase: 0, issue: 0, return: 0, adjustment: 0 });
  }
  for (const row of movementRows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    const bucket = movementByDay.get(key);
    if (!bucket) continue;
    // quantityChange is Decimal(12,3) — Number()-converted before `+=`,
    // since a plain number += a raw Decimal silently string-concatenates
    // instead of adding (Decimal.valueOf() returns a string).
    const change = Number(row.quantityChange);
    if (row.transactionType === "PURCHASE") bucket.purchase += change;
    else if (row.transactionType === "ISSUE") bucket.issue += Math.abs(change);
    else if (row.transactionType === "RETURN") bucket.return += change;
    else if (row.transactionType === "ADJUSTMENT") bucket.adjustment += change;
  }

  return {
    cards: {
      totalParts: stockCounts.totalParts,
      totalStockQuantity: stockCounts.totalStockQty,
      lowStock: stockCounts.lowStock,
      outOfStock: stockCounts.outOfStock,
      partsIssuedToday: Math.abs(Number(issuedToday._sum.quantityChange ?? 0)),
      partsReturnedToday: Number(returnedToday._sum.quantityChange ?? 0),
      purchaseQtyThisMonth: Number(purchaseThisMonthAgg._sum.quantityChange ?? 0),
    },
    stockMovement: Array.from(movementByDay.entries()).map(([date, v]) => ({ date, ...v })),
    topIssuedParts: topIssued,
    lowStockParts,
    recentTransactions: recentLedger.map((l) => ({
      id: l.id,
      date: l.createdAt,
      transactionNumber: l.transactionNumber,
      transactionType: l.transactionType,
      partNo: l.part.partNo,
      description: l.part.description,
      quantityChange: Number(l.quantityChange),
      balanceQuantity: Number(l.balanceQuantity),
      createdByName: l.createdByName,
    })),
  };
}

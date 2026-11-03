import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { computeSubscriptionEndsAt } from "../../lib/billing";
import type { z } from "zod";
import type { selectPlanSchema, createCustomPlanSchema } from "./tenant.schema";

// Same formula as the Super Admin's own custom-plan calculator (fixed,
// non-negotiable rates for a dealer building their own plan — no discount
// lever here, that's Super-Admin-only per PlansPage.tsx).
const CUSTOM_PLAN_BASE = 800;
const CUSTOM_PLAN_PER_USER = 30;
const CUSTOM_PLAN_PER_MENU = 50;

/**
 * Paid tiers a dealer can self-select once their trial ends — deliberately
 * narrower than Super Admin's /admin/plans (which also returns Trial,
 * inactive and custom plans, none of which belongs in front of a dealer).
 * Every active, non-custom, non-Trial plan is included regardless of
 * billing cycle — the frontend groups these into Monthly/Annual tabs.
 */
export async function listSelectablePlans() {
  return prisma.plan.findMany({
    where: { code: { not: "TRIAL" }, isCustom: false, isActive: true },
    orderBy: [{ billingCycle: "asc" }, { priceMonthly: "asc" }],
  });
}

export async function selectPlan(tenantId: string, input: z.infer<typeof selectPlanSchema>) {
  const plan = await prisma.plan.findUnique({ where: { code: input.planCode } });
  if (!plan || !plan.isActive || plan.isCustom) throw ApiError.badRequest("That plan is not currently available", "PLAN_UNAVAILABLE");

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw ApiError.notFound("Dealer not found");

  return prisma.$transaction(async (tx) => {
    await tx.subscription.create({
      data: { tenantId, planId: plan.id, status: "ACTIVE", endsAt: computeSubscriptionEndsAt(new Date(), plan.billingCycle) },
    });
    const updated = await tx.tenant.update({ where: { id: tenantId }, data: { status: "ACTIVE" } });

    await tx.notification.create({
      data: {
        tenantId,
        type: "SYSTEM",
        title: "Plan activated",
        message: `Your dealership is now on the ${plan.name} plan.`,
      },
    });

    return { tenant: updated, plan };
  });
}

/**
 * Dealer-built custom plan — the self-service path a dealer uses once their
 * current cycle (trial or paid) ends, as an alternative to the 3 standard
 * tiers. Price is fixed by the same base/per-user/per-menu formula Super
 * Admin uses (no discount lever here). Usage limits other than users/menus
 * are carried over from whatever plan the dealer was just on, so switching
 * to a custom plan doesn't unexpectedly shrink their stores/parts/txn caps.
 */
export async function createCustomPlan(tenantId: string, input: z.infer<typeof createCustomPlanSchema>) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw ApiError.notFound("Dealer not found");

  const currentSub = await prisma.subscription.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });
  const basePlan = currentSub?.plan;

  const monthlyTotal = CUSTOM_PLAN_BASE + input.maxUsers * CUSTOM_PLAN_PER_USER + input.allowedMenuKeys.length * CUSTOM_PLAN_PER_MENU;
  const priceMonthly = input.billingCycle === "ANNUAL" ? monthlyTotal * 10 : monthlyTotal;

  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.create({
      data: {
        code: `CUSTOM_${tenant.dealerCode}_${Date.now()}`,
        name: `${tenant.name} — Custom Plan`,
        billingCycle: input.billingCycle,
        priceMonthly,
        maxUsers: input.maxUsers,
        maxStores: basePlan?.maxStores ?? 1,
        maxParts: basePlan?.maxParts ?? 500,
        maxMonthlyTxns: basePlan?.maxMonthlyTxns ?? 1000,
        maxExcelUploadRows: basePlan?.maxExcelUploadRows ?? 1000,
        maxStorageMb: basePlan?.maxStorageMb ?? 500,
        allowedMenuKeys: input.allowedMenuKeys,
        isCustom: true,
        isActive: true,
      },
    });

    await tx.subscription.create({
      data: { tenantId, planId: plan.id, status: "ACTIVE", endsAt: computeSubscriptionEndsAt(new Date(), input.billingCycle) },
    });
    const updated = await tx.tenant.update({ where: { id: tenantId }, data: { status: "ACTIVE" } });

    await tx.notification.create({
      data: {
        tenantId,
        type: "SYSTEM",
        title: "Custom plan activated",
        message: `Your dealership is now on a custom plan you built.`,
      },
    });

    return { tenant: updated, plan };
  });
}

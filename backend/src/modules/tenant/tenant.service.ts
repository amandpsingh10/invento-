import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import type { z } from "zod";
import type { selectPlanSchema } from "./tenant.schema";

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
    await tx.subscription.create({ data: { tenantId, planId: plan.id, status: "ACTIVE" } });
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

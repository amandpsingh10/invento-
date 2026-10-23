import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { hashPassword } from "../../lib/password";
import type { z } from "zod";
import type { createTenantSchema, updateTenantSchema } from "./admin.schema";

export async function listTenants() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1, include: { plan: true } },
      _count: { select: { users: true, parts: true, stores: true } },
    },
  });
  return tenants.map((t) => ({
    id: t.id,
    dealerCode: t.dealerCode,
    name: t.name,
    contactPerson: t.contactPerson,
    email: t.email,
    phone: t.phone,
    address: t.address,
    status: t.status,
    trialEndsAt: t.trialEndsAt,
    plan: t.subscriptions[0]?.plan.name ?? null,
    subscriptionStatus: t.subscriptions[0]?.status ?? null,
    userCount: t._count.users,
    partCount: t._count.parts,
    storeCount: t._count.stores,
    createdAt: t.createdAt,
  }));
}

export async function getTenant(id: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: { subscriptions: { orderBy: { createdAt: "desc" }, take: 1, include: { plan: true } } },
  });
  if (!tenant) throw ApiError.notFound("Dealer not found");
  return tenant;
}

export async function createTenant(input: z.infer<typeof createTenantSchema>) {
  const existingDealer = await prisma.tenant.findUnique({ where: { dealerCode: input.dealerCode.toUpperCase() } });
  if (existingDealer) throw ApiError.conflict(`Dealer code "${input.dealerCode}" is already in use`, "DUPLICATE_DEALER_CODE");

  const plan = await prisma.plan.findUnique({ where: { code: input.planCode } });
  if (!plan) throw ApiError.badRequest("Invalid plan");

  const tenantAdminRole = await prisma.role.findUnique({ where: { name: "TENANT_ADMIN" } });
  if (!tenantAdminRole) throw ApiError.internal("TENANT_ADMIN role is not seeded");

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        dealerCode: input.dealerCode.toUpperCase(),
        name: input.name,
        contactPerson: input.contactPerson,
        email: input.email,
        phone: input.phone,
        address: input.address,
        status: input.planCode === "TRIAL" ? "TRIAL" : "ACTIVE",
        trialStartsAt: new Date(),
        trialEndsAt: input.planCode === "TRIAL" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
      },
    });

    await tx.subscription.create({
      data: { tenantId: tenant.id, planId: plan.id, status: input.planCode === "TRIAL" ? "TRIALING" : "ACTIVE" },
    });

    await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: input.adminEmail.toLowerCase(),
        mobile: input.adminMobile,
        firstName: input.adminFirstName,
        lastName: input.adminLastName,
        passwordHash: await hashPassword(input.adminPassword),
        userRoles: { create: { roleId: tenantAdminRole.id } },
      },
    });

    return tenant;
  });
}

export async function updateTenant(id: string, input: z.infer<typeof updateTenantSchema>) {
  await getTenant(id);
  return prisma.tenant.update({ where: { id }, data: input });
}

export async function setTenantStatus(id: string, status: "ACTIVE" | "SUSPENDED" | "CANCELLED") {
  await getTenant(id);
  return prisma.tenant.update({ where: { id }, data: { status } });
}

export async function listTenantUsers(tenantId: string) {
  await getTenant(tenantId);
  const users = await prisma.user.findMany({
    where: { tenantId },
    include: { userRoles: { include: { role: true } } },
    orderBy: { createdAt: "asc" },
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    mobile: u.mobile,
    firstName: u.firstName,
    lastName: u.lastName,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    roles: u.userRoles.map((ur) => ur.role.name),
    createdAt: u.createdAt,
  }));
}

async function requireDealerUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.tenantId) throw ApiError.notFound("User not found");
  return user;
}

export async function getUserMenuAccess(userId: string) {
  await requireDealerUser(userId);
  const rows = await prisma.userMenuAccess.findMany({ where: { userId } });
  return rows.reduce<Record<string, boolean>>((acc, r) => {
    acc[r.menuKey] = r.allowed;
    return acc;
  }, {});
}

export async function setUserMenuAccess(userId: string, items: { menuKey: string; allowed: boolean }[]) {
  await requireDealerUser(userId);
  await prisma.$transaction([
    prisma.userMenuAccess.deleteMany({ where: { userId } }),
    ...(items.length
      ? [
          prisma.userMenuAccess.createMany({
            data: items.map((i) => ({ userId, menuKey: i.menuKey, allowed: i.allowed })),
          }),
        ]
      : []),
  ]);
  return getUserMenuAccess(userId);
}

export async function platformDashboard() {
  const [totalDealers, activeDealers, trialDealers, activeUsers, transactionsToday] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: "ACTIVE" } }),
    prisma.tenant.count({ where: { status: "TRIAL" } }),
    prisma.user.count({ where: { isActive: true, tenantId: { not: null } } }),
    prisma.stockLedger.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
  ]);

  const activeSubs = await prisma.subscription.findMany({
    where: { status: "ACTIVE" },
    include: { plan: true },
  });
  const subscriptionRevenue = activeSubs.reduce((sum, s) => sum + Number(s.plan.priceMonthly), 0);

  return { totalDealers, activeDealers, trialDealers, subscriptionRevenue, activeUsers, transactionsToday };
}

export async function listPlans() {
  return prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: "asc" } });
}

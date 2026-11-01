import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { hashPassword } from "../../lib/password";
import type { z } from "zod";
import type { createUserSchema, updateUserSchema, resetUserPasswordSchema, updateUserMenuAccessSchema } from "./users.schema";

export async function listUsers(tenantId: string) {
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

export async function createUser(tenantId: string, input: z.infer<typeof createUserSchema>) {
  const existingEmail = await prisma.user.findUnique({ where: { tenantId_email: { tenantId, email: input.email.toLowerCase() } } });
  if (existingEmail) throw ApiError.conflict("A user with this email already exists for this dealer", "DUPLICATE_USER_EMAIL");

  // mobile is the login identity and is globally unique (not just per-tenant).
  const existingMobile = await prisma.user.findUnique({ where: { mobile: input.mobile } });
  if (existingMobile) throw ApiError.conflict("A user with this mobile number already exists", "DUPLICATE_USER_MOBILE");

  const role = await prisma.role.findUnique({ where: { name: input.role } });
  if (!role) throw ApiError.badRequest("Invalid role");

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: input.email.toLowerCase(),
      mobile: input.mobile,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: await hashPassword(input.password),
      userRoles: { create: { roleId: role.id } },
    },
  });

  await prisma.notification.create({
    data: {
      tenantId,
      userId: user.id,
      type: "USER_CREATED",
      title: "Welcome to INVENTORY MANAGEMENT SYSTEM",
      message: `Your account has been created with the role ${input.role}.`,
    },
  });

  return user;
}

export async function updateUser(tenantId: string, id: string, input: z.infer<typeof updateUserSchema>) {
  const user = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!user) throw ApiError.notFound("User not found");

  if (input.role) {
    const role = await prisma.role.findUnique({ where: { name: input.role } });
    if (!role) throw ApiError.badRequest("Invalid role");
    await prisma.userRole.deleteMany({ where: { userId: id } });
    await prisma.userRole.create({ data: { userId: id, roleId: role.id } });
  }

  const email = input.email?.toLowerCase();
  if (email && email !== user.email) {
    const existingEmail = await prisma.user.findUnique({ where: { tenantId_email: { tenantId, email } } });
    if (existingEmail && existingEmail.id !== id) {
      throw ApiError.conflict("A user with this email already exists for this dealer", "DUPLICATE_USER_EMAIL");
    }
  }

  if (input.mobile && input.mobile !== user.mobile) {
    const existingMobile = await prisma.user.findUnique({ where: { mobile: input.mobile } });
    if (existingMobile && existingMobile.id !== id) {
      throw ApiError.conflict("A user with this mobile number already exists", "DUPLICATE_USER_MOBILE");
    }
  }

  return prisma.user.update({
    where: { id },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      mobile: input.mobile,
      isActive: input.isActive,
    },
  });
}

export async function deactivateUser(tenantId: string, id: string) {
  const user = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!user) throw ApiError.notFound("User not found");
  return prisma.user.update({ where: { id }, data: { isActive: false, refreshTokenHash: null } });
}

/**
 * Tenant Admin's own view of a dealer user's per-menu overrides — a Super
 * Admin can do the same from the platform side (admin.service.ts), scoped
 * instead to every tenant; this one is scoped to the caller's own tenant
 * only, via the same findFirst({ id, tenantId }) ownership check every
 * other mutation in this file uses. A menu absent from the tenant's plan
 * (Plan.allowedMenuKeys) stays hidden regardless of what's set here — see
 * auth.service.ts loadMenuAccess, which applies that cap on top.
 */
export async function getUserMenuAccess(tenantId: string, id: string) {
  const user = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!user) throw ApiError.notFound("User not found");
  const rows = await prisma.userMenuAccess.findMany({ where: { userId: id } });
  return rows.reduce<Record<string, boolean>>((acc, r) => {
    acc[r.menuKey] = r.allowed;
    return acc;
  }, {});
}

export async function setUserMenuAccess(tenantId: string, id: string, items: z.infer<typeof updateUserMenuAccessSchema>["items"]) {
  const user = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!user) throw ApiError.notFound("User not found");
  await prisma.$transaction([
    prisma.userMenuAccess.deleteMany({ where: { userId: id } }),
    ...(items.length ? [prisma.userMenuAccess.createMany({ data: items.map((i) => ({ userId: id, menuKey: i.menuKey, allowed: i.allowed })) })] : []),
  ]);
  return getUserMenuAccess(tenantId, id);
}

/** Tenant admin resets another dealer user's password (e.g. they're locked out and forgot-password has no email delivery wired up yet). */
export async function resetUserPassword(tenantId: string, id: string, input: z.infer<typeof resetUserPasswordSchema>) {
  const user = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!user) throw ApiError.notFound("User not found");

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      refreshTokenHash: null,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    },
  });

  return { message: "Password updated successfully." };
}

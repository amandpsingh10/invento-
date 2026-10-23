import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { hashPassword, verifyPassword } from "../../lib/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt";
import { ApiError } from "../../lib/apiError";
import { recordAudit } from "../audit/audit.service";
import type { Request } from "express";
import type { RoleName } from "@parts-inventory-system/database";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function loadUserRoles(userId: string): Promise<RoleName[]> {
  const rows = await prisma.userRole.findMany({ where: { userId }, include: { role: true } });
  return rows.map((r) => r.role.name);
}

/**
 * Per-user menu overrides set by SUPER_ADMIN (see admin.routes.ts). Only
 * explicit overrides are returned — an item's absence means the frontend
 * should fall back to its normal role-based default, so this stays empty
 * (and behaviour unchanged) for every user nobody has restricted.
 */
async function loadMenuAccess(userId: string): Promise<Record<string, boolean>> {
  const rows = await prisma.userMenuAccess.findMany({ where: { userId } });
  return rows.reduce<Record<string, boolean>>((acc, r) => {
    acc[r.menuKey] = r.allowed;
    return acc;
  }, {});
}

export async function login(input: { mobile: string; password: string }, req?: Request) {
  // Mobile is globally unique (User.mobile @unique) — it alone identifies
  // both the user and, transitively, their tenant. No dealer code input
  // needed any more; a null tenant means a platform-level (super admin) user.
  const user = await prisma.user.findUnique({ where: { mobile: input.mobile }, include: { tenant: true } });

  if (!user || !user.isActive) {
    throw ApiError.unauthorized("Invalid mobile number or password", "INVALID_CREDENTIALS");
  }

  if (user.tenant && (user.tenant.status === "SUSPENDED" || user.tenant.status === "CANCELLED")) {
    throw ApiError.forbidden("This dealer account is not active. Contact support.", "TENANT_INACTIVE");
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash);
  if (!passwordOk) {
    throw ApiError.unauthorized("Invalid mobile number or password", "INVALID_CREDENTIALS");
  }

  const roles = await loadUserRoles(user.id);
  const menuAccess = await loadMenuAccess(user.id);

  const accessToken = signAccessToken({ sub: user.id, tenantId: user.tenantId, roles });
  const refreshToken = signRefreshToken({ sub: user.id, tenantId: user.tenantId });

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: hashToken(refreshToken), lastLoginAt: new Date() },
  });

  await recordAudit({
    req,
    tenantId: user.tenantId,
    userId: user.id,
    userEmail: user.email,
    role: roles.join(","),
    action: "LOGIN",
    entityType: "SESSION",
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      menuAccess,
    },
    tenant: user.tenant
      ? { id: user.tenant.id, name: user.tenant.name, dealerCode: user.tenant.dealerCode, address: user.tenant.address, state: user.tenant.state }
      : null,
  };
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token", "REFRESH_TOKEN_INVALID");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive || !user.refreshTokenHash) {
    throw ApiError.unauthorized("Session expired, please log in again", "REFRESH_TOKEN_INVALID");
  }

  if (user.refreshTokenHash !== hashToken(refreshToken)) {
    // Refresh token reuse/mismatch — revoke session defensively.
    await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: null } });
    throw ApiError.unauthorized("Session expired, please log in again", "REFRESH_TOKEN_REUSED");
  }

  const roles = await loadUserRoles(user.id);
  const newAccessToken = signAccessToken({ sub: user.id, tenantId: user.tenantId, roles });
  const newRefreshToken = signRefreshToken({ sub: user.id, tenantId: user.tenantId });

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: hashToken(newRefreshToken) },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logout(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } }).catch(() => undefined);
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });
  if (!user) throw ApiError.unauthorized();
  const roles = await loadUserRoles(user.id);
  const menuAccess = await loadMenuAccess(user.id);
  return {
    id: user.id,
    email: user.email,
    mobile: user.mobile,
    firstName: user.firstName,
    lastName: user.lastName,
    roles,
    menuAccess,
    tenant: user.tenant
      ? {
          id: user.tenant.id,
          name: user.tenant.name,
          dealerCode: user.tenant.dealerCode,
          address: user.tenant.address,
          state: user.tenant.state,
          status: user.tenant.status,
        }
      : null,
  };
}

export async function forgotPassword(mobile: string) {
  const user = await prisma.user.findUnique({ where: { mobile } });

  // Always behave the same way regardless of whether the user exists, to avoid
  // leaking account existence via response timing/shape.
  if (user) {
    const rawToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: hashToken(rawToken), passwordResetExpiresAt: expiresAt },
    });

    await prisma.notification.create({
      data: {
        tenantId: user.tenantId ?? "",
        userId: user.id,
        type: "PASSWORD_RESET",
        title: "Password reset requested",
        message: "A password reset was requested for your account. If this wasn't you, contact your administrator.",
      },
    }).catch(() => undefined);

    // In production this token is emailed to the user via a transactional
    // email provider (SES/SendGrid). No email provider is wired up yet, so
    // we log it server-side only — this is NEVER returned in the API response.
    console.log(`[password-reset] token for ${user.email}: ${rawToken} (expires ${expiresAt.toISOString()})`);
  }

  return { message: "If an account with these details exists, a password reset link has been sent." };
}

export async function resetPassword(token: string, newPassword: string) {
  const hashed = hashToken(token);
  const user = await prisma.user.findFirst({
    where: { passwordResetToken: hashed, passwordResetExpiresAt: { gt: new Date() } },
  });
  if (!user) {
    throw ApiError.badRequest("Reset link is invalid or has expired", "RESET_TOKEN_INVALID");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      refreshTokenHash: null,
    },
  });

  return { message: "Password has been reset. Please log in with your new password." };
}

import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../lib/apiError";

/**
 * Guards every tenant-scoped route. Requires requireAuth to have run first.
 * SUPER_ADMIN users have tenantId === null and operate through the separate
 * /api/admin/* (platform) routes instead — they are rejected here so a
 * super-admin token can never be used to silently read/write dealer data.
 */
export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(ApiError.unauthorized());
  if (!req.user.tenantId) {
    return next(ApiError.forbidden("This action requires a dealer account", "TENANT_REQUIRED"));
  }
  next();
}

/** Convenience accessor that fails loudly instead of silently scoping to undefined. */
export function requireTenantId(req: Request): string {
  if (!req.user?.tenantId) {
    throw ApiError.forbidden("This action requires a dealer account", "TENANT_REQUIRED");
  }
  return req.user.tenantId;
}

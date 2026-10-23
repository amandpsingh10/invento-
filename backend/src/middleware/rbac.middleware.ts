import type { Request, Response, NextFunction } from "express";
import type { RoleName } from "@parts-inventory-system/database";
import { ApiError } from "../lib/apiError";

/**
 * Restricts a route to a set of roles. Roles come from the JWT (req.user.roles),
 * which were themselves derived server-side at login from the user's
 * UserRole rows — never from client input.
 */
export function requireRole(...allowed: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    const hasRole = req.user.roles.some((r) => allowed.includes(r));
    if (!hasRole) {
      return next(ApiError.forbidden(`Requires one of: ${allowed.join(", ")}`));
    }
    next();
  };
}

export const ROLE_GROUPS = {
  canManageTenantSettings: ["TENANT_ADMIN"] as RoleName[],
  canManageMasters: ["TENANT_ADMIN"] as RoleName[],
  canUploadPurchases: ["TENANT_ADMIN", "INVENTORY_MANAGER"] as RoleName[],
  canIssueOrReturn: ["TENANT_ADMIN", "INVENTORY_MANAGER", "STORE_USER"] as RoleName[],
  canAdjustStock: ["TENANT_ADMIN", "INVENTORY_MANAGER"] as RoleName[],
  canViewReports: ["TENANT_ADMIN", "INVENTORY_MANAGER", "STORE_USER", "VIEWER"] as RoleName[],
  canManageUsers: ["TENANT_ADMIN"] as RoleName[],
  superAdminOnly: ["SUPER_ADMIN"] as RoleName[],
};

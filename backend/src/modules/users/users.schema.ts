import { z } from "zod";
import { passwordPolicy } from "../auth/auth.schema";
import { indianMobileSchema } from "../../utils/validators";

export const createUserSchema = z.object({
  email: z.string().email("Enter a valid email"),
  mobile: indianMobileSchema,
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  password: passwordPolicy,
  role: z.enum(["TENANT_ADMIN", "INVENTORY_MANAGER", "STORE_USER", "VIEWER"]),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email("Enter a valid email").optional(),
  mobile: indianMobileSchema.optional(),
  role: z.enum(["TENANT_ADMIN", "INVENTORY_MANAGER", "STORE_USER", "VIEWER"]).optional(),
  isActive: z.boolean().optional(),
});

/** Tenant admins can reset another user's password without knowing the current one. */
export const resetUserPasswordSchema = z.object({
  newPassword: passwordPolicy,
});

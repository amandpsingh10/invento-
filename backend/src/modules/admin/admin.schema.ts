import { z } from "zod";
import { passwordPolicy } from "../auth/auth.schema";
import { indianMobileSchema } from "../../utils/validators";
import { MENU_KEY_SET } from "./menuKeys";

export const createTenantSchema = z.object({
  dealerCode: z.string().min(2, "Dealer Code is required").max(50).regex(/^[A-Z0-9_-]+$/i, "Use letters, numbers, - or _ only"),
  name: z.string().min(1, "Dealer Name is required").max(200),
  contactPerson: z.string().max(150).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  // Any plan code now, not just the original 4 — Super Admin can create
  // annual or one-off custom plans (see createPlanSchema) and assign a
  // dealer straight to one.
  planCode: z.string().min(1, "Plan is required").default("TRIAL"),
  adminEmail: z.string().email("Admin email is required"),
  adminMobile: indianMobileSchema,
  adminPassword: passwordPolicy,
  adminFirstName: z.string().min(1).max(100),
  adminLastName: z.string().min(1).max(100),
});

export const changeTenantPlanSchema = z.object({
  planCode: z.string().min(1, "Plan is required"),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  contactPerson: z.string().max(150).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  status: z.enum(["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"]).optional(),
});

export const updatePlanSchema = z.object({
  name: z.string().min(1, "Plan name is required").max(100).optional(),
  description: z.string().max(300).optional().nullable(),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).optional(),
  priceMonthly: z.coerce.number().min(0, "Price cannot be negative").optional(),
  maxUsers: z.coerce.number().int().min(1, "Must allow at least 1 user").optional(),
  maxStores: z.coerce.number().int().min(1, "Must allow at least 1 store").optional(),
  maxParts: z.coerce.number().int().min(1, "Must allow at least 1 part").optional(),
  maxMonthlyTxns: z.coerce.number().int().min(1, "Must allow at least 1 transaction").optional(),
  maxExcelUploadRows: z.coerce.number().int().min(1).optional(),
  maxStorageMb: z.coerce.number().int().min(1).optional(),
  allowedMenuKeys: z.array(z.string().refine((k) => MENU_KEY_SET.has(k), "Unknown menu key")).optional(),
  isCustom: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const createPlanSchema = z.object({
  code: z
    .string()
    .min(2, "Plan code is required")
    .max(60)
    .regex(/^[A-Z0-9_]+$/, "Use uppercase letters, numbers and _ only")
    .transform((v) => v.toUpperCase()),
  name: z.string().min(1, "Plan name is required").max(100),
  description: z.string().max(300).optional().nullable(),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
  priceMonthly: z.coerce.number().min(0, "Price cannot be negative"),
  maxUsers: z.coerce.number().int().min(1, "Must allow at least 1 user"),
  maxStores: z.coerce.number().int().min(1, "Must allow at least 1 store"),
  maxParts: z.coerce.number().int().min(1, "Must allow at least 1 part"),
  maxMonthlyTxns: z.coerce.number().int().min(1, "Must allow at least 1 transaction"),
  maxExcelUploadRows: z.coerce.number().int().min(1),
  maxStorageMb: z.coerce.number().int().min(1),
  allowedMenuKeys: z.array(z.string().refine((k) => MENU_KEY_SET.has(k), "Unknown menu key")).default([]),
  // A plan built for one dealer's negotiated terms — kept off the
  // dealer-facing self-service plan picker; Super Admin assigns it
  // directly from the Dealers page instead (see tenant.service.ts).
  isCustom: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updateMenuAccessSchema = z.object({
  items: z.array(
    z.object({
      menuKey: z.string().refine((k) => MENU_KEY_SET.has(k), "Unknown menu key"),
      allowed: z.boolean(),
    })
  ),
});

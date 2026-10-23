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
  planCode: z.enum(["TRIAL", "BASIC", "PRO", "ENTERPRISE"]).default("TRIAL"),
  adminEmail: z.string().email("Admin email is required"),
  adminMobile: indianMobileSchema,
  adminPassword: passwordPolicy,
  adminFirstName: z.string().min(1).max(100),
  adminLastName: z.string().min(1).max(100),
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
  priceMonthly: z.coerce.number().min(0, "Price cannot be negative").optional(),
  maxUsers: z.coerce.number().int().min(1, "Must allow at least 1 user").optional(),
  maxStores: z.coerce.number().int().min(1, "Must allow at least 1 store").optional(),
  maxParts: z.coerce.number().int().min(1, "Must allow at least 1 part").optional(),
  maxMonthlyTxns: z.coerce.number().int().min(1, "Must allow at least 1 transaction").optional(),
  maxExcelUploadRows: z.coerce.number().int().min(1).optional(),
  maxStorageMb: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const updateMenuAccessSchema = z.object({
  items: z.array(
    z.object({
      menuKey: z.string().refine((k) => MENU_KEY_SET.has(k), "Unknown menu key"),
      allowed: z.boolean(),
    })
  ),
});

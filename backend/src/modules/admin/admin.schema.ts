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

export const updateMenuAccessSchema = z.object({
  items: z.array(
    z.object({
      menuKey: z.string().refine((k) => MENU_KEY_SET.has(k), "Unknown menu key"),
      allowed: z.boolean(),
    })
  ),
});

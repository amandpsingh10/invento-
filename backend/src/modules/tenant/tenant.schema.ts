import { z } from "zod";
import { MENU_KEY_SET } from "../admin/menuKeys";

/**
 * A dealer building their own custom plan (self-service renewal path) —
 * price is computed server-side from the fixed base/per-user/per-menu
 * formula, never trusted from the client.
 */
export const createCustomPlanSchema = z.object({
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]),
  maxUsers: z.coerce.number().int().min(1, "Must allow at least 1 user"),
  allowedMenuKeys: z.array(z.string().refine((k) => MENU_KEY_SET.has(k), "Unknown menu key")),
});

/**
 * Any non-Trial, non-custom plan code is selectable here (monthly or
 * annual tiers alike — see listSelectablePlans) — a dealer picks one when
 * their trial runs out, they never pick their way back onto Trial, and a
 * custom plan is assigned to them directly by Super Admin instead.
 */
export const selectPlanSchema = z.object({
  planCode: z.string().min(1),
});

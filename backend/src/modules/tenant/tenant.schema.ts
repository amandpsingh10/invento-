import { z } from "zod";

/**
 * Any non-Trial, non-custom plan code is selectable here (monthly or
 * annual tiers alike — see listSelectablePlans) — a dealer picks one when
 * their trial runs out, they never pick their way back onto Trial, and a
 * custom plan is assigned to them directly by Super Admin instead.
 */
export const selectPlanSchema = z.object({
  planCode: z.string().min(1),
});

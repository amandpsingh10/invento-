import { z } from "zod";

/** Only the 3 paid tiers are selectable here — a dealer picks one when their trial runs out, they never pick their way back onto Trial. */
export const selectPlanSchema = z.object({
  planCode: z.enum(["BASIC", "PRO", "ENTERPRISE"]),
});

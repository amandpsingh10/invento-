import { z } from "zod";

export const createAdjustmentSchema = z.object({
  inventoryId: z.string().uuid("Select a valid stock location"),
  // Whole-number-only unless the underlying part's unit is ML/KGS —
  // enforced in adjustments.service.ts once the part is loaded.
  physicalQuantity: z.coerce.number().min(0, "Physical Quantity cannot be negative"),
  reasonType: z.enum(["DAMAGE", "THEFT", "COUNT_CORRECTION", "EXPIRY", "OTHER"], {
    errorMap: () => ({ message: "Adjustment Reason is required" }),
  }),
  remarks: z.string().max(500).optional(),
});
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;

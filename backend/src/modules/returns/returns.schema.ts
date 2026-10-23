import { z } from "zod";

export const createReturnSchema = z
  .object({
    // Exactly one of these two must be provided — a return traces back to
    // either the plain "Part Issue" flow (no invoice, returnable directly)
    // or a customer sale (must be a CANCELLED invoice — see sales.service.ts).
    issueItemId: z.string().uuid().optional(),
    invoiceItemId: z.string().uuid().optional(),
    // Whole-number-only unless the underlying part's unit is ML/KGS —
    // enforced in returns.service.ts once the part is loaded.
    quantity: z.coerce.number().positive("Return Quantity must be greater than 0"),
    remarks: z.string().max(500).optional(),
  })
  .refine((v) => !!v.issueItemId !== !!v.invoiceItemId, {
    message: "Provide exactly one of issueItemId or invoiceItemId",
  });
export type CreateReturnInput = z.infer<typeof createReturnSchema>;

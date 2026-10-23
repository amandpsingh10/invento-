import { z } from "zod";

export const createIssueSchema = z.object({
  inventoryId: z.string().uuid("Select a valid stock location"),
  // Whole-number-only unless the part's unit is ML/KGS — that depends on
  // the part behind inventoryId, so it's enforced in issues.service.ts
  // once the part record is loaded, not here.
  quantity: z.coerce.number().positive("Issue Quantity must be greater than 0"),
  reference: z.string().max(300).optional(),
  remarks: z.string().max(500).optional(),
});
export type CreateIssueInput = z.infer<typeof createIssueSchema>;

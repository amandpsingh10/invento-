import { z } from "zod";
import { PART_UNITS } from "../../utils/quantity";
import { PART_CATEGORIES } from "../../utils/partCategory";

export const createPartSchema = z.object({
  partNo: z.string().min(1, "Part No is required").max(50),
  description: z.string().min(1, "Part Description is required").max(300),
  taxPercent: z.coerce.number().min(0, "Tax % cannot be negative").max(100, "Tax % cannot exceed 100"),
  hsnCode: z.string().max(20).optional(),
  // MRP is deliberately not accepted here — it's computed server-side from
  // NDP, dealer margin and tax (see utils/pricing.ts).
  ndp: z.coerce.number().min(0, "NDP cannot be negative"),
  dealerMarginPercent: z.coerce.number().min(0, "Dealer margin % cannot be negative").max(500, "Dealer margin % cannot exceed 500").optional().default(0),
  unit: z.enum(PART_UNITS).optional().default("NOS"),
  category: z.enum(PART_CATEGORIES).optional().default("P"),
  // Present-but-blank means "clear it" (→ null), not "leave unchanged" —
  // the Parts admin form always sends this field, so an empty input has to
  // actually clear a previously-set barcode rather than silently no-op.
  barcode: z
    .string()
    .max(64)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),
  minimumStockLevel: z.coerce.number().int().min(0).optional().default(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
});

export const updatePartSchema = createPartSchema.partial();

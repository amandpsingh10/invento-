import { z } from "zod";

export const createStoreSchema = z.object({
  code: z.string().min(1, "Store Code is required").max(30),
  name: z.string().min(1, "Store Name is required").max(150),
  address: z.string().max(500).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
});

export const updateStoreSchema = createStoreSchema.partial();

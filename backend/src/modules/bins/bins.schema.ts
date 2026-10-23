import { z } from "zod";

export const createBinSchema = z.object({
  storeId: z.string().uuid("Store is required"),
  code: z.string().min(1, "Bin Code is required").max(30),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
});

export const updateBinSchema = createBinSchema.partial();

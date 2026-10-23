import { z } from "zod";

export const createRackSchema = z.object({
  storeId: z.string().uuid("Store is required"),
  code: z.string().min(1, "Rack Code is required").max(30),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
});

export const updateRackSchema = createRackSchema.partial();

import { z } from "zod";

const indianMobile = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

// Loose format check (15 chars, standard GSTIN alphanumeric pattern) —
// optional per spec, so an empty string/undefined is always accepted.
const gstin = z
  .string()
  .trim()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid GSTIN")
  .optional()
  .or(z.literal(""));

const pincode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter a valid 6-digit pincode")
  .optional()
  .or(z.literal(""));

export const customerInputSchema = z.object({
  name: z.string().trim().min(1, "Customer Name is required"),
  mobile: indianMobile,
  address: z.string().trim().max(300).optional().or(z.literal("")),
  // pincode/state/city drive the CGST+SGST vs IGST split (see
  // sales.service.ts) — pincode is auto-looked-up client-side but state is
  // what's actually compared against the dealer's state, so it's kept
  // editable and optional rather than strictly required, in case the
  // lookup API is unavailable.
  pincode,
  state: z.string().trim().max(100).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  gstin: gstin,
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
});

export const saleItemInputSchema = z.object({
  inventoryId: z.string().uuid("Select a valid stock location"),
  // Whole-number-only unless the underlying part's unit is ML/KGS —
  // enforced in sales.service.ts once the part is loaded.
  quantity: z.coerce.number().positive("Sale Quantity must be greater than 0"),
  // Defaults to the part's MRP when omitted — see spec section 10: selling
  // price must not be permanently hard-coded to NDP.
  sellingPrice: z.coerce.number().min(0).optional(),
});

export const createSaleSchema = z.object({
  customer: customerInputSchema,
  items: z.array(saleItemInputSchema).min(1, "Add at least one part to the sale"),
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const cancelInvoiceSchema = z.object({
  reason: z.string().trim().min(1, "A cancellation reason is required").max(500),
});

import { z } from "zod";

/** 10-digit Indian mobile number — shared across auth, user management, and tenant onboarding. */
export const indianMobileSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number");

import { z } from "zod";
import { indianMobileSchema } from "../../utils/validators";

export const loginSchema = z.object({
  mobile: indianMobileSchema,
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  mobile: indianMobileSchema,
});

const passwordPolicy = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordPolicy,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordPolicy,
});

export { passwordPolicy };

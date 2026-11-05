import {
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_USER_NAME_LENGTH,
} from "@taskforge/shared";
import { z } from "zod";

/** The rules for a password being set: on sign-up, change and reset. */
const newPassword = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
  )
  .max(
    MAX_PASSWORD_LENGTH,
    `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
  )
  .regex(/[a-zA-Z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

const passwordsMismatch = {
  error: "Passwords do not match",
  path: ["confirmPassword"],
};

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(
        MIN_USER_NAME_LENGTH,
        `Name must be at least ${MIN_USER_NAME_LENGTH} characters`,
      )
      .max(MAX_NAME_LENGTH, `Name must be at most ${MAX_NAME_LENGTH} characters`),
    email: z.email("Enter a valid email address"),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, passwordsMismatch);

/**
 * Signed-in password change (`PATCH /auth/password`). The current password is
 * only checked by the backend; `confirmPassword` is form-only and is not sent.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, passwordsMismatch)
  .refine((data) => data.password !== data.currentPassword, {
    error: "Choose a password different from your current one",
    path: ["password"],
  });

/** "Forgot password": the address to send a reset link to. */
export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address"),
});

/** The form behind a reset link. `confirmPassword` is form-only. */
export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, passwordsMismatch);

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

import { api } from "@/lib/axios";

import { ApiResponse } from "@/types/api";

import type {
  GoogleAuthRequest,
  GoogleAuthResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyEmailRequest,
} from "../types/auth-types";

/**
 * Auth API layer. All auth network calls live here (AI_GUIDE: never call
 * fetch/axios directly from components or pages).
 *
 * Every function returns the full `ApiResponse` envelope (via `api` in
 * `lib/axios`); callers unwrap `.data` where only the payload matters.
 *
 * Validation, password hashing, and JWT issuance are the backend's job
 * (spec/auth.md). The frontend only forwards credentials and reads the result.
 */

/**
 * Exchange Google OAuth profile for a backend-issued session.
 * Called from the Auth.js Google provider `profile` callback (server side).
 */
export async function googleLogin(
  payload: GoogleAuthRequest,
): Promise<ApiResponse<GoogleAuthResponse>> {
  return api.post<GoogleAuthResponse>("/auth/google", payload);
}

/**
 * Exchange credentials for a backend-issued session.
 * Called from the Auth.js Credentials `authorize` callback (server side).
 */
export async function login(
  payload: LoginRequest,
): Promise<ApiResponse<LoginResponse>> {
  return api.post<LoginResponse>("/auth/login", payload);
}

/**
 * Start a sign-up. Nothing is created yet: the backend emails a link to
 * `/verify-email`, and following it creates the account. The answer is the
 * same for an address that already has an account.
 */
export async function register(
  payload: RegisterRequest,
): Promise<ApiResponse<RegisterResponse>> {
  return api.post<RegisterResponse>("/auth/register", payload);
}

/**
 * Finish a sign-up from the emailed link: creates the account and signs in.
 * Called from the Auth.js `email-verification` provider (server side).
 */
export async function verifyEmail(
  payload: VerifyEmailRequest,
): Promise<ApiResponse<LoginResponse>> {
  return api.post<LoginResponse>("/auth/verify-email", payload);
}

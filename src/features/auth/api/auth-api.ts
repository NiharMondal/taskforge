import { api } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
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
 * Exchange credentials for a backend-issued session.
 * Called from the Auth.js Credentials `authorize` callback (server side).
 */
export async function login(
  payload: LoginRequest,
): Promise<ApiResponse<LoginResponse>> {
  return api.post<LoginResponse>("/auth/login", payload);
}

/**
 * Create a new account. Registration is owned entirely by the backend;
 * on success the UI redirects the user to /login (spec/auth.md).
 */
export async function register(
  payload: RegisterRequest,
): Promise<ApiResponse<RegisterResponse>> {
  return api.post<RegisterResponse>("/auth/register", payload);
}

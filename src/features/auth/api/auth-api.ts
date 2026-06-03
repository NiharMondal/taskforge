import { apiClient } from "@/lib/axios";

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
 * Validation, password hashing, and JWT issuance are the backend's job
 * (spec/auth.md). The frontend only forwards credentials and reads the result.
 */

/**
 * Exchange credentials for a backend-issued session.
 * Called from the Auth.js Credentials `authorize` callback (server side).
 */
export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const { data } = await apiClient.post<ApiResponse<LoginResponse>>(
    "/auth/login",
    payload,
  );
  return data.data;
}

/**
 * Create a new account. Registration is owned entirely by the backend;
 * on success the UI redirects the user to /login (spec/auth.md).
 */
export async function register(payload: RegisterRequest): Promise<ApiResponse<RegisterResponse>> {
  const { data } = await apiClient.post<ApiResponse<RegisterResponse>>("/auth/register", payload);
  return data
}

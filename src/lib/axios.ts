import axios from "axios";
import type { AxiosRequestConfig } from "axios";

import type { ApiResponse } from "@/types/api";

import { getActiveWorkspaceId } from "./active-workspace";
import { toApiError } from "./api-error";
import { getAuthToken } from "./auth-token";

/**
 * Central axios instance. Import `apiClient` everywhere — never call axios
 * directly so interceptors (auth header, error normalization) always apply.
 *
 * All data access belongs in the service / feature-api layer, never in
 * components (see AGENTS.md).
 */
const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001/api/v1";

export const apiClient = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// Request: attach the Bearer JWT and the active-workspace context.
// The token identifies the *user*; `x-workspace-id` identifies the *tenant* the
// request applies to (AI_GUIDE → "every request must include workspace context").
apiClient.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  const workspaceId = getActiveWorkspaceId();
  if (workspaceId) {
    config.headers.set("x-workspace-id", workspaceId);
  }
  return config;
});

// Response: normalize every failure into an `ApiError` so callers handle one shape.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toApiError(error)),
);

/**
 * Typed request helpers for the backend's `ApiResponse` envelope.
 *
 * The backend wraps every success body in `{ success, statusCode, message, data }`
 * (see `types/api`), so feature API layers should call these instead of
 * `apiClient` directly — each method returns the envelope already typed, and the
 * payload type is given once at the call site:
 *
 *   const res = await api.get<Project[]>("/projects"); // ApiResponse<Project[]>
 *   res.data    // Project[]
 *   res.message // for toasts after mutations
 *
 * Callers that only want the payload unwrap `.data` themselves (e.g. React
 * Query `queryFn`s, so caches hold plain domain data). Errors never reach the
 * envelope: the interceptor above rejects with a normalized `ApiError`.
 */
export const api = {
  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    const res = await apiClient.get<ApiResponse<T>>(url, config);
    return res.data;
  },

  post: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    const res = await apiClient.post<ApiResponse<T>>(url, body, config);
    return res.data;
  },

  patch: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    const res = await apiClient.patch<ApiResponse<T>>(url, body, config);
    return res.data;
  },

  put: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    const res = await apiClient.put<ApiResponse<T>>(url, body, config);
    return res.data;
  },

  delete: async <T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    const res = await apiClient.delete<ApiResponse<T>>(url, config);
    return res.data;
  },
};

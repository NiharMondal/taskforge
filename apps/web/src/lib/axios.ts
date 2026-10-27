import axios from "axios";
import type { AxiosRequestConfig } from "axios";

import type { ApiResponse } from "@/types/api";

import { getActiveWorkspaceId } from "./active-workspace";
import { API_URL } from "./api-url";
import { toApiError } from "./api-error";
import { getAuthToken, notifyUnauthorized } from "./auth-token";

/**
 * Central axios instance. Import `apiClient` everywhere — never call axios
 * directly so interceptors (auth header, error normalization) always apply.
 *
 * All data access belongs in the service / feature-api layer, never in
 * components (see AGENTS.md).
 */
const WORKSPACE_HEADER = "x-workspace-id";

/**
 * Request config that pins a request to `workspaceId`. Workspace-scoped feature
 * APIs take the id from their caller (the hook, which also keys its cache by
 * it) and pass this, so a response can only ever land in the cache entry of the
 * workspace it was fetched for — never the one that happens to be active when
 * it is sent or arrives.
 */
export function inWorkspace(
  workspaceId: string,
  config: AxiosRequestConfig = {},
): AxiosRequestConfig {
  return {
    ...config,
    headers: { ...config.headers, [WORKSPACE_HEADER]: workspaceId },
  };
}

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// Request: attach the Bearer JWT and the active-workspace context.
// The token identifies the *user*; `x-workspace-id` identifies the *tenant* the
// request applies to (AI_GUIDE → "every request must include workspace context").
//
// A request that names its workspace (see `inWorkspace`) keeps it. Otherwise
// the active workspace is read *before* awaiting the token: that await can be a
// network round-trip, and a workspace switch during it must not re-target a
// request that was started for the previous workspace.
apiClient.interceptors.request.use(async (config) => {
  if (!config.headers.has(WORKSPACE_HEADER)) {
    const workspaceId = getActiveWorkspaceId();
    if (workspaceId) {
      config.headers.set(WORKSPACE_HEADER, workspaceId);
    }
  }

  const token = await getAuthToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// Response: normalize every failure into an `ApiError` so callers handle one shape.
// A 401 means the backend token expired/was rejected — the Auth.js cookie may
// still look valid, so we signal the auth layer to sign the user out instead of
// leaving them on a protected page with every request failing.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error);
    if (apiError.status === 401) {
      notifyUnauthorized();
    }
    return Promise.reject(apiError);
  },
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

  delete: async <T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    const res = await apiClient.delete<ApiResponse<T>>(url, config);
    return res.data;
  },
};

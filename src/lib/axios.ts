import axios from "axios";

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

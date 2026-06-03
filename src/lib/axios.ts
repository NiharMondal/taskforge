import axios from "axios";

import { toApiError } from "./api-error";
import { getAuthToken } from "./auth-token";

/**
 * Central axios instance. Import `apiClient` everywhere — never call axios
 * directly so interceptors (auth header, error normalization) always apply.
 *
 * All data access belongs in the service / feature-api layer, never in
 * components (see AGENTS.md).
 */
const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

export const apiClient = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// Request: attach the Bearer JWT resolved from the registered auth source.
apiClient.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// Response: normalize every failure into an `ApiError` so callers handle one shape.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toApiError(error)),
);

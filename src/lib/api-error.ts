import { AxiosError } from "axios";

import type { ApiErrorResponse } from "@/types/api";

/**
 * Normalized error thrown by the API client.
 *
 * Every rejected request from `apiClient` is converted into an `ApiError`, so
 * UI / React Query `onError` handlers can rely on a single, predictable shape
 * instead of branching on AxiosError internals.
 */
export class ApiError extends Error {
  /** HTTP status code, or 0 for network/timeout failures. */
  readonly status: number;
  /** Raw response body, if the server returned one. */
  readonly data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/** Convert an unknown thrown value (usually an AxiosError) into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    const status = error.response?.status ?? 0;
    const body = error.response?.data as ApiErrorResponse | undefined;
    const message = extractMessage(body) ?? error.message ?? "Request failed";
    return new ApiError(message, status, error.response?.data);
  }

  if (error instanceof Error) return new ApiError(error.message, 0);
  return new ApiError("Unknown error", 0);
}

function extractMessage(body?: ApiErrorResponse): string | undefined {
  if (!body?.message) return undefined;
  return Array.isArray(body.message) ? body.message.join(", ") : body.message;
}

/**
 * Best-effort user-facing message for any thrown value. Everything rejected by
 * `apiClient` is already an {@link ApiError}, but this normalizes unknown throws
 * too so UI error handlers can render a string unconditionally.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error instanceof ApiError) return error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

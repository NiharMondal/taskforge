/**
 * Shared API contract types.
 *
 * Backend (NestJS-style) error payloads typically look like:
 *   { statusCode: 401, message: "Unauthorized", error: "Unauthorized" }
 *   { statusCode: 400, message: ["email must be an email"], error: "Bad Request" }
 */
export interface ApiErrorResponse {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

/** Generic envelope for paginated list endpoints. Adjust to match real backend contracts. */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Shared API contract types.
 *
 * The backend wraps EVERY response in a `{ success, statusCode, message, ... }`
 * envelope:
 *   success: { success: true,  statusCode: 200, message: "...", data: T }
 *   error:   { success: false, statusCode: 401, message: "Invalid password", error: "Unauthorized" }
 *
 * Note that error messages can be a single string or an array (validation).
 */
export interface ApiResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  /** Present on paginated list endpoints (backend `IPaginationMeta`). */
  metaData?: PaginationMeta;
  data: T;
}

/** Paging info the backend's `PrismaQueryBuilder` attaches to list responses. */
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalData: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiErrorResponse {
  success?: false;
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

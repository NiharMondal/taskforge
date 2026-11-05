/**
 * The response envelope. Every backend controller answers through
 * `sendResponse()`, and the web's `api` wrapper unwraps `data`.
 */

/** Paging info on list responses (the backend's `PrismaQueryBuilder`). */
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalData: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  /** Present on paginated list endpoints. */
  metaData?: PaginationMeta;
  data: T;
}

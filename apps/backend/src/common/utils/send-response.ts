import { HttpStatus } from "@nestjs/common";
import type { ApiResponse, PaginationMeta } from "@taskforge/shared";

export const sendResponse = <T>({
  statusCode,
  message,
  data,
  metaData,
}: {
  statusCode: HttpStatus;
  message: string;
  data: T;
  metaData?: PaginationMeta;
}): ApiResponse<T> => {
  return {
    success: true,
    statusCode,
    message,
    metaData,
    data,
  };
};

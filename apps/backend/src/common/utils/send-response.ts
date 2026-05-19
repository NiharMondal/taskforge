import { HttpStatus } from "@nestjs/common";

type TMetaData = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type TApiResponse<T> = {
  success: boolean;
  statusCode: number;
  message: string;
  metaData?: TMetaData;
  data: T;
};

export const sendResponse = <T>({
  statusCode,
  message,
  data,
  metaData,
}: {
  statusCode: HttpStatus;
  message: string;
  data: T;
  metaData?: TMetaData;
}): TApiResponse<T> => {
  return {
    success: true,
    statusCode,
    message,
    metaData,
    data,
  };
};

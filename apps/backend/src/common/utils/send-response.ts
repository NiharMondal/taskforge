import { IPaginationMeta } from "@/lib/PrismQueryBuilder";
import { HttpStatus } from "@nestjs/common";

type TApiResponse<T> = {
  success: boolean;
  statusCode: number;
  message: string;
  metaData?: IPaginationMeta;
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
  metaData?: IPaginationMeta;
}): TApiResponse<T> => {
  return {
    success: true,
    statusCode,
    message,
    metaData,
    data,
  };
};

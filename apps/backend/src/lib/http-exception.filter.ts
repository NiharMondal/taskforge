import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import { Prisma } from "generated/prisma/client";

/**
 * Prisma errors the API can explain to the caller. Anything else from Prisma is
 * a bug and stays a 500.
 */
const PRISMA_ERRORS: Record<string, { status: HttpStatus; message: string }> = {
  // Unique constraint (e.g. two registrations with one email at once).
  P2002: {
    status: HttpStatus.CONFLICT,
    message: "A record with these details already exists",
  },
  // Foreign key (e.g. deleting a row something still points at).
  P2003: {
    status: HttpStatus.CONFLICT,
    message: "This record is still referenced by other data",
  },
  // Update/delete of a row that is gone (e.g. deleted concurrently).
  P2025: { status: HttpStatus.NOT_FOUND, message: "Record not found" },
};

/**
 * Every error leaves the API in the same envelope:
 * `{ success: false, statusCode, message }` (plus `error` for HttpExceptions),
 * which the web app normalizes to `ApiError`.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const body =
        typeof exceptionResponse === "string"
          ? { statusCode: status, message: exceptionResponse }
          : (exceptionResponse as Record<string, unknown>);

      response.status(status).json({ success: false, ...body });
      return;
    }

    const known =
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? PRISMA_ERRORS[exception.code]
        : undefined;

    if (known) {
      response.status(known.status).json({
        success: false,
        statusCode: known.status,
        message: known.message,
      });
      return;
    }

    // Unexpected: log the detail, never send it (it can include SQL, row
    // values or stack traces).
    this.logger.error(
      exception instanceof Error ? exception.message : String(exception),
      exception instanceof Error ? exception.stack : undefined,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
}

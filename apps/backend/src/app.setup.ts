import { HttpExceptionFilter } from "@/lib/http-exception.filter";
import {
  INestApplication,
  ValidationPipe,
  ValidationPipeOptions,
} from "@nestjs/common";
import helmet from "helmet";

const DEFAULT_CORS_ORIGINS = ["http://localhost:3000", "http://localhost:3001"];

/** `CORS_ORIGINS` is a comma-separated list; unset means the local web app. */
export const corsOrigins = (value = process.env.CORS_ORIGINS): string[] => {
  const origins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length ? origins : DEFAULT_CORS_ORIGINS;
};

/**
 * The global pipe's options; the controller specs build their pipe from these
 * too. A body or query key the DTO doesn't declare is a 400 rather than
 * silently dropped, so a client sending a misspelled or unsupported field
 * hears about it. (`whitelist` is what keeps undeclared query keys away from
 * PrismaQueryBuilder's `.filter()`.)
 */
export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
};

/**
 * Everything the HTTP app needs besides `listen()`. Shared by `main.ts` and the
 * e2e tests so the tests exercise the real prefix, validation and error shape.
 */
export function configureApp<T extends INestApplication>(app: T): T {
  app.use(helmet());
  app.enableCors({ origin: corsOrigins(), credentials: true });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
  app.setGlobalPrefix("api/v1");
  return app;
}

import { PrismaService } from "@/prisma/prisma.service";
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";

/**
 * How long the database gets to answer. The pg pool waits indefinitely for a
 * connection by default, so without this an unreachable database would hang
 * the check instead of failing it.
 */
export const HEALTH_DB_TIMEOUT_MS = 3_000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private prisma: PrismaService) {}

  /** `{ status, db, uptime }`, or a 503 when the database doesn't answer. */
  async check() {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`no answer in ${HEALTH_DB_TIMEOUT_MS} ms`)),
        HEALTH_DB_TIMEOUT_MS,
      );
    });

    try {
      // Raw, like the advisory locks: there is no model to read, only a
      // round trip to make.
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
    } catch (error) {
      // Logged here, never sent: the detail can name the host or user.
      this.logger.error(
        `Database health check failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException({
        statusCode: 503,
        message: "Database unavailable",
        status: "error",
        db: "down",
      });
    } finally {
      clearTimeout(timer);
    }

    return {
      status: "ok" as const,
      db: "ok" as const,
      uptime: Math.round(process.uptime()),
    };
  }
}

import { Public } from "@/common/decorators/public.decorator";
import { sendResponse } from "@/common/utils/send-response";
import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, timingSafeEqual } from "node:crypto";
import { CleanupService } from "./cleanup.service";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * For an external scheduler (a GitHub Actions cron, cron-job.org, …) on hosts
 * whose instances sleep, such as Render's free tier, where the in-process
 * `@Cron` can't fire. Public to the JWT guard, but it takes
 * `Authorization: Bearer <CRON_SECRET>`; without `CRON_SECRET` it is a 503.
 */
@Controller("maintenance")
export class MaintenanceController {
  constructor(
    private readonly cleanup: CleanupService,
    private readonly config: ConfigService,
  ) {}

  @Post("cleanup")
  @HttpCode(HttpStatus.OK)
  @Public()
  async runCleanup(@Headers("authorization") authorization?: string) {
    this.assertCronSecret(authorization);
    const report = await this.cleanup.run();
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: report
        ? "Cleanup finished"
        : "Cleanup is already running elsewhere",
      data: report,
    });
  }

  private assertCronSecret(authorization: string | undefined) {
    const secret = this.config.get<string>("CRON_SECRET");
    if (!secret) {
      throw new ServiceUnavailableException("Maintenance is not configured");
    }
    const sent = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";
    // Compared as fixed-length digests, so neither length nor timing leaks.
    if (!timingSafeEqual(digest(sent), digest(secret))) {
      throw new UnauthorizedException("Invalid maintenance secret");
    }
  }
}

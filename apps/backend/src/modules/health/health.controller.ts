import { Public } from "@/common/decorators/public.decorator";
import { sendResponse } from "@/common/utils/send-response";
import { Controller, Get, HttpStatus } from "@nestjs/common";
import { HealthService } from "./health.service";

/**
 * For hosting platforms and uptime monitors: 200 while the API can reach the
 * database, 503 otherwise. Public and not throttled (no throttler applies
 * outside the auth routes).
 */
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  async check() {
    const result = await this.healthService.check();
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Healthy",
      data: result,
    });
  }
}

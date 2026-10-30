import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Throttles a signed-in route per user rather than per client address, so
 * people behind one proxy don't share a budget and one user can't spread
 * requests over addresses. The global `JwtAuthGuard` has set `req.user` by
 * the time this runs.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>) {
    const sub = (req.user as { sub?: string } | undefined)?.sub;
    return sub ? `user:${sub}` : super.getTracker(req);
  }
}

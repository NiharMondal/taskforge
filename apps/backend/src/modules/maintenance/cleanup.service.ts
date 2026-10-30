import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InvitationStatus } from "generated/prisma/enums";

const DAY_MS = 86_400_000;

/** Revoked, replaced or expired refresh tokens are kept this long, then deleted. */
export const REFRESH_TOKEN_RETENTION_DAYS = 30;

/** Stripe stops retrying a webhook after 3 days; the event ids are kept longer. */
export const STRIPE_EVENT_RETENTION_DAYS = 90;

/** Daily, at an off-hour (UTC). */
export const CLEANUP_CRON = "17 3 * * *";

/** Every instance shares this lock, so only one runs the cleanup at a time. */
const CLEANUP_LOCK = "maintenance:cleanup";

/** How long one run may hold the lock (its transaction stays open meanwhile). */
const CLEANUP_TIMEOUT_MS = 10 * 60_000;

export type CleanupTask =
  | "pendingRegistrations"
  | "passwordResets"
  | "refreshTokens"
  | "expiredInvitations"
  | "stripeEvents";

/** Rows each task deleted or updated; `null` for a task that failed. */
export type CleanupReport = Record<CleanupTask, number | null>;

/**
 * Deletes rows nothing needs any more, and marks expired invitations EXPIRED.
 * Runs daily from `@Cron`, and on demand (`POST /maintenance/cleanup`,
 * `pnpm run cleanup`) for hosts that sleep through the schedule. Every task is
 * idempotent, so a missed or repeated run does no harm.
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CLEANUP_CRON, { name: "cleanup", timeZone: "UTC" })
  async runScheduled() {
    await this.run();
  }

  /**
   * Runs every task, each on its own so one failure doesn't stop the rest.
   * Returns `null`, doing nothing, while another instance holds the lock.
   *
   * The lock is a transaction-level advisory lock, held by a transaction that
   * stays open for the run; the tasks themselves run outside it, so a failing
   * one can't abort the others.
   */
  async run(now = new Date()): Promise<CleanupReport | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtextextended(${CLEANUP_LOCK}::text, 0)) AS locked`;
        if (!locked) {
          this.logger.log("Cleanup skipped: another instance is running it");
          return null;
        }
        return this.runTasks(now);
      },
      { timeout: CLEANUP_TIMEOUT_MS },
    );
  }

  private async runTasks(now: Date): Promise<CleanupReport> {
    const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS);
    const retiredBefore = daysAgo(REFRESH_TOKEN_RETENTION_DAYS);

    const tasks: Record<CleanupTask, () => Promise<{ count: number }>> = {
      pendingRegistrations: () =>
        this.prisma.pendingRegistration.deleteMany({
          where: { expiresAt: { lte: now } },
        }),
      passwordResets: () =>
        this.prisma.passwordReset.deleteMany({
          where: { expiresAt: { lte: now } },
        }),
      refreshTokens: () =>
        this.prisma.refreshToken.deleteMany({
          where: {
            OR: [
              { expiresAt: { lte: retiredBefore } },
              { revokedAt: { lte: retiredBefore } },
              { replacedAt: { lte: retiredBefore } },
            ],
          },
        }),
      expiredInvitations: () =>
        this.prisma.invitation.updateMany({
          where: { status: InvitationStatus.PENDING, expiresAt: { lte: now } },
          data: { status: InvitationStatus.EXPIRED },
        }),
      stripeEvents: () =>
        this.prisma.stripeEvent.deleteMany({
          where: { processedAt: { lte: daysAgo(STRIPE_EVENT_RETENTION_DAYS) } },
        }),
    };

    const report = {} as CleanupReport;
    for (const [name, task] of Object.entries(tasks) as [
      CleanupTask,
      () => Promise<{ count: number }>,
    ][]) {
      try {
        report[name] = (await task()).count;
      } catch (error) {
        report[name] = null;
        this.logger.error(
          `Cleanup task ${name} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    this.logger.log(`Cleanup finished: ${JSON.stringify(report)}`);
    return report;
  }
}

import { futureDate, generateToken, hashToken } from "@/helper";
import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { Prisma } from "generated/prisma/client";
import {
  REFRESH_TOKEN_REUSE_GRACE_MS,
  REFRESH_TOKEN_TTL_DAYS,
} from "./auth.constants";

type Db = Pick<Prisma.TransactionClient, "refreshToken">;

const invalidToken = () =>
  new UnauthorizedException("Your session has ended. Sign in again.");

/**
 * Opaque refresh tokens with rotation. A sign-in starts a family; each refresh
 * marks the presented token replaced and issues the next one in the family.
 * A replaced token presented again after REFRESH_TOKEN_REUSE_GRACE_MS can only
 * be a copy, so the whole family is revoked: the thief and the owner both have
 * to sign in again, and the owner's next sign-in shuts the thief out.
 *
 * Only SHA-256 hashes are stored. Access tokens are signed by AuthService.
 */
@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** A new token for `userId`, in `familyId` or in a family of its own. */
  async issue(userId: string, familyId: string = randomUUID()) {
    const token = generateToken();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashToken(token),
        expiresAt: futureDate(REFRESH_TOKEN_TTL_DAYS),
      },
    });
    return token;
  }

  /**
   * Spend `token`: who it belongs to and which family the next one joins.
   * 401 when it is unknown, expired, revoked, or reused after the grace period.
   */
  async consume(token: string): Promise<{ userId: string; familyId: string }> {
    const now = new Date();
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!stored || stored.revokedAt || stored.expiresAt <= now) {
      throw invalidToken();
    }

    if (stored.replacedAt) {
      if (
        now.getTime() - stored.replacedAt.getTime() >
        REFRESH_TOKEN_REUSE_GRACE_MS
      ) {
        await this.revokeFamily(stored.familyId);
        throw invalidToken();
      }
    } else {
      // Only one request can mark it replaced. Losing that race to a
      // concurrent refresh is fine (it is within the grace period), unless the
      // other request revoked it.
      const claimed = await this.prisma.refreshToken.updateMany({
        where: { id: stored.id, replacedAt: null, revokedAt: null },
        data: { replacedAt: now },
      });
      if (claimed.count === 0) {
        const current = await this.prisma.refreshToken.findUnique({
          where: { id: stored.id },
        });
        if (!current || current.revokedAt) throw invalidToken();
      }
    }

    // Housekeeping: the user's expired tokens can no longer be used or reused.
    await this.prisma.refreshToken.deleteMany({
      where: { userId: stored.userId, expiresAt: { lte: now } },
    });

    return { userId: stored.userId, familyId: stored.familyId };
  }

  /** Sign-out: revoke `token`'s family. Unknown tokens are ignored. */
  async revoke(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { familyId: true },
    });
    if (stored) await this.revokeFamily(stored.familyId);
  }

  /** End every session of `userId`, e.g. when the account changes hands. */
  async revokeAllForUser(userId: string, db: Db = this.prisma) {
    await db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

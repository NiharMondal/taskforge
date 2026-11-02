import PrismaQueryBuilder from "@/lib/PrismQueryBuilder";
import { PrismaService } from "@/prisma/prisma.service";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "generated/prisma/client";
import { PlatformRole, WorkspaceRole } from "generated/prisma/enums";
import { RefreshTokenService } from "../auth/refresh-token.service";
import { AccountService } from "../user/account.service";
import { WorkspaceService } from "../workspace/workspace.service";
import {
  AdminReasonDto,
  QueryPlatformAuditLogDto,
  SetSuspendedDto,
} from "./dto/admin-action.dto";
import { recordPlatformEvent } from "./platform-audit";

/**
 * What platform ADMINs can do to accounts and workspaces
 * (`spec/admin-spec.md`): suspend and lift it, end sessions, delete. Each
 * action writes one `PlatformAuditLog` row in the transaction of the change,
 * with the reason given. Nobody acts on their own account or on another
 * ADMIN's.
 *
 * Plans are never changed here: a free or discounted plan is made in Stripe
 * (a coupon or a longer trial), so the webhook stays the only writer of
 * `Subscription`.
 */
@Injectable()
export class AdminActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly accounts: AccountService,
    private readonly workspaces: WorkspaceService,
  ) {}

  /**
   * Suspend an account (it can't sign in, refresh or verify an email; every
   * session ends now, and its current access token lapses within 15
   * minutes), or lift the suspension. 409 when it is already in that state.
   */
  async setUserSuspended(
    actorId: string,
    userId: string,
    { suspended, reason }: SetSuspendedDto,
  ) {
    const user = await this.actionableUser(actorId, userId);

    await this.prisma.$transaction(async (tx) => {
      // Conditional, so two admins acting at once can't both succeed.
      const { count } = await tx.user.updateMany({
        where: { id: userId, suspendedAt: suspended ? null : { not: null } },
        data: suspended
          ? { suspendedAt: new Date(), suspendedReason: reason }
          : { suspendedAt: null, suspendedReason: null },
      });
      if (count === 0) {
        throw new ConflictException(
          suspended
            ? "This user is already suspended"
            : "This user isn't suspended",
        );
      }
      if (suspended) await this.refreshTokens.revokeAllForUser(userId, tx);

      await recordPlatformEvent(tx, {
        actorId,
        action: suspended ? "user.suspended" : "user.unsuspended",
        targetId: userId,
        metadata: { name: user.name, email: user.email, reason },
      });
    });
  }

  /**
   * Sign the user out everywhere: every refresh token is revoked. Access
   * tokens already handed out last up to 15 minutes. Returns how many
   * sessions were still usable.
   */
  async revokeSessions(
    actorId: string,
    userId: string,
    { reason }: AdminReasonDto,
  ) {
    const user = await this.actionableUser(actorId, userId);

    return this.prisma.$transaction(async (tx) => {
      const revoked = await this.refreshTokens.revokeAllForUser(userId, tx);
      await recordPlatformEvent(tx, {
        actorId,
        action: "user.sessions_revoked",
        targetId: userId,
        metadata: { name: user.name, email: user.email, reason, revoked },
      });
      return { revoked };
    });
  }

  /**
   * Delete an account through the same steps as `DELETE /users/me`: still a
   * 409 while it owns a workspace other people use; the workspaces only it
   * belongs to go with it (subscriptions canceled first).
   */
  async deleteUser(
    actorId: string,
    userId: string,
    { reason }: AdminReasonDto,
  ) {
    const user = await this.actionableUser(actorId, userId);

    await this.accounts.deleteAccountAsStaff(userId, (tx, deletedWorkspaces) =>
      recordPlatformEvent(tx, {
        actorId,
        action: "user.deleted",
        targetId: userId,
        metadata: {
          name: user.name,
          email: user.email,
          reason,
          deletedWorkspaces,
        },
      }),
    );
  }

  /**
   * Suspend a workspace (every workspace-scoped request is a 403
   * WORKSPACE_SUSPENDED; Stripe is untouched), or lift it. 409 when it is
   * already in that state.
   */
  async setWorkspaceSuspended(
    actorId: string,
    workspaceId: string,
    { suspended, reason }: SetSuspendedDto,
  ) {
    const workspace = await this.findWorkspace(workspaceId);

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.workspace.updateMany({
        where: {
          id: workspaceId,
          suspendedAt: suspended ? null : { not: null },
        },
        data: suspended
          ? { suspendedAt: new Date(), suspendedReason: reason }
          : { suspendedAt: null, suspendedReason: null },
      });
      if (count === 0) {
        throw new ConflictException(
          suspended
            ? "This workspace is already suspended"
            : "This workspace isn't suspended",
        );
      }

      await recordPlatformEvent(tx, {
        actorId,
        action: suspended ? "workspace.suspended" : "workspace.unsuspended",
        targetId: workspaceId,
        metadata: { name: workspace.name, reason },
      });
    });
  }

  /**
   * Delete a workspace through `WorkspaceService.delete`, so its subscription
   * is canceled with Stripe first (502/503 and nothing deleted if that
   * fails). The audit row is written in the deleting transaction, with the
   * owner and member count read there, before they cascade away.
   */
  async deleteWorkspace(
    actorId: string,
    workspaceId: string,
    { reason }: AdminReasonDto,
  ) {
    const workspace = await this.findWorkspace(workspaceId);

    await this.workspaces.delete(workspaceId, async (tx) => {
      const [owner, memberCount] = await Promise.all([
        tx.membership.findFirst({
          where: { workspaceId, role: WorkspaceRole.OWNER },
          select: { user: { select: { id: true, name: true, email: true } } },
        }),
        tx.membership.count({ where: { workspaceId } }),
      ]);
      await recordPlatformEvent(tx, {
        actorId,
        action: "workspace.deleted",
        targetId: workspaceId,
        metadata: {
          name: workspace.name,
          reason,
          owner: owner?.user ?? null,
          memberCount,
        },
      });
    });
  }

  /** The platform audit log, newest first, optionally for one target. */
  async auditLog(query: QueryPlatformAuditLogDto) {
    const where: Prisma.PlatformAuditLogWhereInput = {};
    if (query.targetType) where.targetType = query.targetType;
    if (query.targetId) where.targetId = query.targetId;

    return new PrismaQueryBuilder<Prisma.PlatformAuditLogWhereInput>(query, {
      defaultField: "createdAt",
      defaultOrder: "desc",
    })
      .withDefaultFilter(where)
      .paginate()
      .sort()
      .select({
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
      })
      .execute(this.prisma.platformAuditLog);
  }

  /**
   * The user an action is about: never the actor, never another ADMIN
   * (SUPPORT staff and everyone else are fair game). 403 for those, 404 when
   * there is no such user.
   */
  private async actionableUser(actorId: string, userId: string) {
    if (userId === actorId) {
      throw new ForbiddenException("You can't do this to your own account");
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, platformRole: true },
    });
    if (!user) throw new NotFoundException("User not found");
    if (user.platformRole === PlatformRole.ADMIN) {
      throw new ForbiddenException("Admins can't act on other admins");
    }
    return user;
  }

  private async findWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });
    if (!workspace) throw new NotFoundException("Workspace not found");
    return workspace;
  }
}

import { CloudinaryService } from "@/cloudinary/cloudinary.service";
import { passwordUtils } from "@/common/utils/password";
import { appUrl, normalizeEmail } from "@/helper";
import {
  recordWorkspaceEvent,
  roleRef,
} from "@/modules/activity/workspace-activity";
import { BillingService } from "@/modules/billing/billing.service";
import { MailService } from "@/modules/mail/mail.service";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthProvider, WorkspaceRole } from "generated/prisma/enums";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { accountDeletedEmail } from "./user-emails";

type WorkspaceRef = { id: string; name: string };

/** 409: the caller owns workspaces other people still use. */
const ownsSharedWorkspaces = (workspaces: WorkspaceRef[]) =>
  new ConflictException({
    statusCode: 409,
    message: `You own ${workspaces.length === 1 ? "a workspace" : "workspaces"} other people use: ${workspaces
      .map((w) => w.name)
      .join(
        ", ",
      )}. Transfer ownership (Settings → General) or delete them first.`,
    workspaces,
  });

/**
 * Leaving the product (`spec/user-spec.md`): deleting your own account and
 * downloading your data. Both act on the caller only — `User` has no tenant
 * scope, so the JWT subject is the boundary, like the rest of `/users`.
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly cloudinary: CloudinaryService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Delete the caller's account. Refused (409) while they own a workspace
   * with other members; the workspaces only they belong to are deleted with
   * it, subscriptions canceled first as `WorkspaceService.delete` does.
   * Issues they reported and comments they wrote in shared workspaces stay,
   * with a null reporter or author (SetNull); memberships, sign-in methods and
   * refresh tokens cascade. Leaving each shared workspace is logged as
   * `member.left` (the row's actor becomes null with the user; its metadata
   * still names them).
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarPublicId: true,
        auths: {
          where: { provider: AuthProvider.EMAIL },
          select: { password: true },
        },
        memberships: {
          select: {
            workspaceId: true,
            role: true,
            assignedRole: { select: { id: true, name: true } },
            workspace: {
              select: { name: true, _count: { select: { memberships: true } } },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException("User not found");

    await this.assertConfirmed(user, dto);

    // `role` is kept in step with the Role row for the OWNER, who is never a
    // custom role (transfer-ownership writes both).
    const owned = user.memberships.filter(
      (m) => m.role === WorkspaceRole.OWNER,
    );
    const left = user.memberships.filter((m) => m.role !== WorkspaceRole.OWNER);
    const sharedOwned = owned.filter((m) => m.workspace._count.memberships > 1);
    if (sharedOwned.length) {
      throw ownsSharedWorkspaces(
        sharedOwned.map((m) => ({ id: m.workspaceId, name: m.workspace.name })),
      );
    }

    const soloIds = owned.map((m) => m.workspaceId);
    // Outside the transaction: it calls Stripe. A 502/503 stops the deletion
    // before anything is deleted, as it does for a workspace.
    for (const workspaceId of soloIds) {
      await this.billing.cancelForDeletion(workspaceId);
    }

    await this.prisma.$transaction(async (tx) => {
      if (soloIds.length) {
        // Someone may have accepted an invitation since the check above.
        const joined = await tx.membership.findMany({
          where: { workspaceId: { in: soloIds }, userId: { not: userId } },
          select: { workspace: { select: { id: true, name: true } } },
          distinct: ["workspaceId"],
        });
        if (joined.length) {
          throw ownsSharedWorkspaces(joined.map((m) => m.workspace));
        }
        await tx.workspace.deleteMany({ where: { id: { in: soloIds } } });
      }

      for (const membership of left) {
        await recordWorkspaceEvent(tx, {
          workspaceId: membership.workspaceId,
          userId,
          action: "member.left",
          entityId: userId,
          metadata: {
            member: { id: userId, name: user.name },
            role: roleRef(membership.assignedRole, membership.role),
          },
        });
      }

      await tx.user.delete({ where: { id: userId } });
    });

    await this.cloudinary.delete(user.avatarPublicId);
    this.mail.sendInBackground({
      to: user.email,
      ...accountDeletedEmail({
        name: user.name,
        url: appUrl(this.config, "/"),
      }),
    });
    // One fewer seat in each workspace they left (never throws).
    await Promise.all(left.map((m) => this.billing.syncSeats(m.workspaceId)));
  }

  /**
   * Everything the account holds about the caller, as JSON: the profile, its
   * sign-in methods (never the hash), memberships, and the issues they
   * reported or are assigned and the comments they wrote — in the workspaces
   * they still belong to. A workspace they left keeps its rows, and a former
   * member doesn't read a tenant's data any more.
   */
  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        auths: { select: { provider: true, createdAt: true } },
      },
    });
    if (!user) throw new NotFoundException("User not found");

    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        role: true,
        createdAt: true,
        assignedRole: { select: { id: true, name: true } },
        workspace: { select: { id: true, name: true } },
      },
    });
    const workspaceIds = memberships.map((m) => m.workspace.id);

    const [issues, comments] = await Promise.all([
      this.prisma.issue.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          OR: [{ reporterId: userId }, { assigneeId: userId }],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          number: true,
          title: true,
          description: true,
          priority: true,
          type: true,
          timeEstimate: true,
          reporterId: true,
          assigneeId: true,
          createdAt: true,
          updatedAt: true,
          status: { select: { name: true } },
          project: { select: { key: true, name: true } },
          workspace: { select: { name: true } },
        },
      }),
      this.prisma.comment.findMany({
        where: { userId, issue: { workspaceId: { in: workspaceIds } } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          issue: {
            select: {
              id: true,
              number: true,
              title: true,
              project: { select: { key: true } },
              workspace: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const { auths, ...profile } = user;
    return {
      exportedAt: new Date().toISOString(),
      profile: {
        ...profile,
        signInMethods: auths.map((a) => ({
          provider: a.provider,
          addedAt: a.createdAt,
        })),
      },
      memberships: memberships.map((m) => ({
        workspace: m.workspace,
        role: roleRef(m.assignedRole, m.role).name,
        joinedAt: m.createdAt,
      })),
      issues: issues.map(
        ({
          number,
          project,
          workspace,
          status,
          reporterId,
          assigneeId,
          ...issue
        }) => ({
          ...issue,
          key: `${project.key}-${number}`,
          workspace: workspace.name,
          project: project.name,
          status: status.name,
          reportedByYou: reporterId === userId,
          assignedToYou: assigneeId === userId,
        }),
      ),
      comments: comments.map(({ issue, ...comment }) => ({
        ...comment,
        workspace: issue.workspace.name,
        issue: {
          id: issue.id,
          key: `${issue.project.key}-${issue.number}`,
          title: issue.title,
        },
      })),
    };
  }

  /**
   * An account with a password confirms with it; a Google-only one (no
   * password to ask for) types its email. 400, never 401: the web reads a 401
   * as a dead session.
   */
  private async assertConfirmed(
    user: { email: string; auths: { password: string | null }[] },
    dto: DeleteAccountDto,
  ) {
    const hash = user.auths[0]?.password;
    if (hash) {
      if (!dto.password) {
        throw new BadRequestException(
          "Enter your password to delete your account",
        );
      }
      if (!(await passwordUtils.comparePassword(dto.password, hash))) {
        throw new BadRequestException("Your password is incorrect");
      }
      return;
    }

    if (
      !dto.confirmEmail ||
      normalizeEmail(dto.confirmEmail) !== normalizeEmail(user.email)
    ) {
      throw new BadRequestException(
        "Type your account's email address to confirm",
      );
    }
  }
}

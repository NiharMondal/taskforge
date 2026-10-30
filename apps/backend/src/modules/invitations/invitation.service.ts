import { appUrl, futureDate, generateToken, normalizeEmail } from "@/helper";
import {
  assertActorHolds,
  WorkspaceAccess,
} from "@/common/permissions/workspace-access";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { assertCanAddMember } from "@/common/plans/plan-limits";
import PrismaQueryBuilder from "@/lib/PrismQueryBuilder";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InvitationStatus, WorkspaceRole } from "generated/prisma/enums";
import { recordWorkspaceEvent } from "../activity/workspace-activity";
import { BillingService } from "../billing/billing.service";
import { MailService } from "../mail/mail.service";
import { SYSTEM_ROLE_NAMES } from "@taskforge/shared";
import { findSystemRole, resolveAssignableRole } from "../roles/system-roles";
import { SendInvitationDto } from "./dto/send-invitation.dto";
import { invitationEmail } from "./invitation-emails";

/**
 * What callers of the API may see of an invitation. `token` is excluded: it is
 * the credential that grants membership and only ever travels by email.
 */
const PUBLIC_INVITATION_SELECT = {
  id: true,
  email: true,
  workspaceId: true,
  role: true,
  roleId: true,
  // The role it grants, by name: `role` reads MEMBER for a custom one.
  assignedRole: { select: { id: true, name: true, systemKey: true } },
  status: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class InvitationService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private config: ConfigService,
    private billing: BillingService,
  ) {}

  /** `invitation:manage` is checked on the route. */
  async sendInvitation(
    workspaceId: string,
    actor: WorkspaceAccess,
    dto: SendInvitationDto,
  ) {
    const invitedRole = await resolveAssignableRole(
      this.prisma,
      workspaceId,
      dto.roleId === undefined && dto.role === undefined
        ? { role: WorkspaceRole.MEMBER }
        : { roleId: dto.roleId, role: dto.role },
    );
    const role = invitedRole.enumRole;
    assertActorHolds(
      actor,
      invitedRole.permissions,
      "invite someone with more access",
    );

    // Rows may predate normalization, so match case-insensitively but always
    // store the lowercase form.
    const email = normalizeEmail(dto.email);

    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });

    if (existingUser) {
      const existingMembership = await this.prisma.membership.findUnique({
        where: {
          userId_workspaceId: { userId: existingUser.id, workspaceId },
        },
      });
      if (existingMembership) {
        throw new ConflictException(
          "This email is already a member of the workspace",
        );
      }
    }

    const existing = await this.prisma.invitation.findFirst({
      where: { workspaceId, email: { equals: email, mode: "insensitive" } },
    });

    // A PENDING invite past its expiry is dead (it only becomes EXPIRED when
    // someone opens the link or the daily cleanup runs), so it must not block
    // a re-invite.
    if (
      existing?.status === InvitationStatus.PENDING &&
      existing.expiresAt > new Date()
    ) {
      throw new ConflictException(
        "A pending invitation already exists for this email",
      );
    }

    const token = generateToken();
    const expiresAt = futureDate(); // By Default 7 Days
    const roleId = invitedRole.id;

    const invitation = await this.prisma.$transaction(async (tx) => {
      // The invitation reserves a seat, so the plan is checked here and not
      // on accept. A re-sent expired or revoked one holds no seat until now.
      // The check locks the workspace's seats until this commits, so of two
      // invitations racing for the last seat, the second sees the first.
      await assertCanAddMember(tx, workspaceId);

      const saved = await tx.invitation.upsert({
        // Key on the stored spelling so a legacy mixed-case row is updated,
        // not duplicated next to a new lowercase one.
        where: {
          email_workspaceId: { email: existing?.email ?? email, workspaceId },
        },
        create: { email, token, workspaceId, role, roleId, expiresAt },
        update: {
          email,
          token,
          role,
          roleId,
          expiresAt,
          status: InvitationStatus.PENDING,
        },
        select: PUBLIC_INVITATION_SELECT,
      });
      await recordWorkspaceEvent(tx, {
        workspaceId,
        userId: actor.userId,
        action: "invitation.sent",
        entityId: saved.id,
        metadata: {
          email,
          role: { id: invitedRole.id, name: invitedRole.name },
        },
      });
      return saved;
    });

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    const actor_user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { name: true },
    });

    // In the background: a transient email failure must not roll back a
    // successfully persisted invitation. Failures are logged.
    this.mail.sendInBackground({
      to: email,
      ...invitationEmail({
        inviterName: actor_user?.name ?? "A workspace member",
        workspaceName: workspace?.name ?? "a workspace",
        url: appUrl(
          this.config,
          `/invitations/accept?token=${encodeURIComponent(token)}`,
        ),
      }),
    });

    return invitation;
  }

  async listInvitations(workspaceId: string, query: PaginationQueryDto) {
    return new PrismaQueryBuilder(query, {
      defaultField: "createdAt",
      defaultOrder: "desc",
    })
      .withDefaultFilter({ workspaceId })
      .paginate()
      .sort()
      .select(PUBLIC_INVITATION_SELECT)
      .execute(this.prisma.invitation);
  }

  async validateToken(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        workspace: { select: { name: true } },
        assignedRole: { select: { name: true } },
      },
    });

    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    // The daily cleanup marks expired invitations EXPIRED; say so, as below.
    if (invitation.status === InvitationStatus.EXPIRED) {
      throw new BadRequestException("Invitation has expired");
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        "Invitation has already been used or revoked",
      );
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new BadRequestException("Invitation has expired");
    }

    return {
      email: invitation.email,
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspace.name,
      role: invitation.role,
      roleName:
        invitation.assignedRole?.name ?? SYSTEM_ROLE_NAMES[invitation.role],
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        "Invitation has already been accepted, revoked, or expired",
      );
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new BadRequestException("Invitation has expired");
    }

    // `userId` is the JWT subject, i.e. User.id.
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (normalizeEmail(user.email) !== normalizeEmail(invitation.email)) {
      throw new ForbiddenException(
        "This invitation was sent to a different email address",
      );
    }

    const existingMembership = await this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: invitation.workspaceId },
      },
    });

    if (existingMembership) {
      throw new ConflictException("You are already a member of this workspace");
    }

    const accepted = await this.prisma.$transaction(async (tx) => {
      // Claim the invitation first, and only if it is still the one checked
      // above: PENDING, unexpired, same token. Between that check and now it
      // may have been revoked, re-sent (new token, maybe a new role) or
      // accepted by a parallel request; any of those leaves 0 rows claimed and
      // nothing is written. The row lock this takes also serializes two
      // accepts of the same invitation.
      const claimed = await tx.invitation.updateMany({
        where: {
          id: invitation.id,
          token,
          status: InvitationStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
        data: { status: InvitationStatus.ACCEPTED },
      });

      if (claimed.count === 0) {
        throw new BadRequestException(
          "Invitation has already been accepted, revoked, or expired",
        );
      }

      // Invitations sent before roles existed have no roleId; map their enum.
      const role =
        (invitation.roleId &&
          (await tx.role.findUnique({
            where: { id: invitation.roleId },
            select: { id: true, name: true },
          }))) ||
        (await findSystemRole(tx, invitation.workspaceId, invitation.role));
      const roleId = invitation.roleId ?? role.id;

      // A membership created since the check above makes this a P2002, which
      // rolls back the claim and answers 409.
      const membership = await tx.membership.create({
        data: {
          userId,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
          roleId,
        },
      });

      await recordWorkspaceEvent(tx, {
        workspaceId: invitation.workspaceId,
        userId,
        action: "invitation.accepted",
        entityId: invitation.id,
        metadata: {
          email: invitation.email,
          role: { id: role.id, name: role.name },
        },
      });

      return { workspaceId: invitation.workspaceId, membership };
    });

    // After the commit: a Stripe failure must not undo the membership.
    await this.billing.syncSeats(accepted.workspaceId);
    return accepted;
  }

  /** `invitation:manage` is checked on the route. */
  async revokeInvitation(
    workspaceId: string,
    invitationId: string,
    actorId: string,
  ) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, workspaceId },
    });

    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException("Only pending invitations can be revoked");
    }

    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.invitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.REVOKED },
      });
      await recordWorkspaceEvent(tx, {
        workspaceId,
        userId: actorId,
        action: "invitation.revoked",
        entityId: invitationId,
        metadata: { email: invitation.email },
      });
      return revoked;
    });
  }
}

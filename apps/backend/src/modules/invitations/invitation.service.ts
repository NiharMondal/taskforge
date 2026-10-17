import {
  escapeHtml,
  futureDate,
  generateToken,
  normalizeEmail,
} from "@/helper";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InvitationStatus, WorkspaceRole } from "generated/prisma/enums";
import { MailService } from "../mail/mail.service";
import { SendInvitationDto } from "./dto/send-invitation.dto";

/**
 * What callers of the API may see of an invitation. `token` is excluded: it is
 * the credential that grants membership and only ever travels by email.
 */
const PUBLIC_INVITATION_SELECT = {
  id: true,
  email: true,
  workspaceId: true,
  role: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  async sendInvitation(
    workspaceId: string,
    actorUserId: string,
    dto: SendInvitationDto,
  ) {
    const actor = await this.prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: actorUserId, workspaceId } },
    });

    if (
      !actor ||
      !([WorkspaceRole.OWNER, WorkspaceRole.ADMIN] as WorkspaceRole[]).includes(
        actor.role,
      )
    ) {
      throw new ForbiddenException("Insufficient permissions");
    }

    // Rows may predate normalization, so match case-insensitively but always
    // store the lowercase form.
    const email = normalizeEmail(dto.email);

    const existingAuth = await this.prisma.auth.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });

    if (existingAuth) {
      // Membership is keyed by User.id, which is `Auth.userId` — not `Auth.id`.
      const existingMembership = await this.prisma.membership.findUnique({
        where: {
          userId_workspaceId: { userId: existingAuth.userId, workspaceId },
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

    // A PENDING invite past its expiry is dead (nothing flips it to EXPIRED
    // until someone opens the link), so it must not block a re-invite.
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
    const role = dto.role ?? WorkspaceRole.MEMBER;

    const invitation = await this.prisma.invitation.upsert({
      // Key on the stored spelling so a legacy mixed-case row is updated, not
      // duplicated next to a new lowercase one.
      where: {
        email_workspaceId: { email: existing?.email ?? email, workspaceId },
      },
      create: { email, token, workspaceId, role, expiresAt },
      update: {
        email,
        token,
        role,
        expiresAt,
        status: InvitationStatus.PENDING,
      },
      select: PUBLIC_INVITATION_SELECT,
    });

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    const actor_user = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { name: true },
    });

    // Fire-and-forget: a transient email failure must not roll back a
    // successfully persisted invitation. Failures are logged for retry/audit.
    void this.sendInvitationEmail({
      to: email,
      inviterName: actor_user?.name ?? "A workspace member",
      workspaceName: workspace?.name ?? "a workspace",
      token,
    }).catch((error) => {
      this.logger.error(
        `Failed to send invitation email to ${email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return invitation;
  }

  async listInvitations(workspaceId: string) {
    return this.prisma.invitation.findMany({
      where: { workspaceId },
      select: PUBLIC_INVITATION_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  async validateToken(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { workspace: { select: { name: true } } },
    });

    if (!invitation) {
      throw new NotFoundException("Invitation not found");
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

    // `userId` is the JWT subject, i.e. User.id — look the Auth row up by its
    // `userId` column, not its own primary key.
    const auth = await this.prisma.auth.findUnique({ where: { userId } });
    if (!auth) {
      throw new NotFoundException("User not found");
    }

    if (normalizeEmail(auth.email) !== normalizeEmail(invitation.email)) {
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

    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.create({
        data: {
          userId,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });

      return { workspaceId: invitation.workspaceId, membership };
    });
  }

  async revokeInvitation(
    workspaceId: string,
    invitationId: string,
    actorUserId: string,
  ) {
    const actor = await this.prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: actorUserId, workspaceId } },
    });

    if (
      !actor ||
      !([WorkspaceRole.OWNER, WorkspaceRole.ADMIN] as WorkspaceRole[]).includes(
        actor.role,
      )
    ) {
      throw new ForbiddenException("Insufficient permissions");
    }

    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, workspaceId },
    });

    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException("Only pending invitations can be revoked");
    }

    return this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED },
    });
  }

  private async sendInvitationEmail(params: {
    to: string;
    inviterName: string;
    workspaceName: string;
    token: string;
  }) {
    const appUrl =
      this.config.get<string>("APP_URL") ?? "http://localhost:3000";
    const acceptUrl = `${appUrl.replace(/\/+$/, "")}/invitations/accept?token=${encodeURIComponent(
      params.token,
    )}`;

    const subject = `${params.inviterName} invited you to join "${params.workspaceName}" on TaskForge`;

    const text =
      `${params.inviterName} has invited you to join the "${params.workspaceName}" workspace on TaskForge.\n\n` +
      `Accept your invitation: ${acceptUrl}\n\n` +
      `This invitation expires in 7 days. If you weren't expecting this, you can safely ignore this email.`;

    // Inviter and workspace names are user-controlled, so they must be escaped
    // before landing in the HTML part (the subject and text part are plain text).
    const inviterName = escapeHtml(params.inviterName);
    const workspaceName = escapeHtml(params.workspaceName);
    const safeUrl = escapeHtml(acceptUrl);

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="margin-bottom: 8px;">You've been invited to TaskForge</h2>
        <p><strong>${inviterName}</strong> has invited you to join the
          <strong>${workspaceName}</strong> workspace.</p>
        <p style="margin: 24px 0;">
          <a href="${safeUrl}"
             style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
            Accept invitation
          </a>
        </p>
        <p style="font-size: 13px; color: #666;">
          Or paste this link into your browser:<br />
          <a href="${safeUrl}">${safeUrl}</a>
        </p>
        <p style="font-size: 12px; color: #999; margin-top: 24px;">
          This invitation expires in 7 days. If you weren't expecting this, you can safely ignore this email.
        </p>
      </div>
    `;

    await this.mail.sendMail({ to: params.to, subject, text, html });
  }
}

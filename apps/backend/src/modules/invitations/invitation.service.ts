import { futureDate, generateToken } from "@/helper";
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

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
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

    const existing = await this.prisma.invitation.findUnique({
      where: { email_workspaceId: { email: dto.email, workspaceId } },
    });

    if (existing?.status === InvitationStatus.PENDING) {
      throw new ConflictException(
        "A pending invitation already exists for this email",
      );
    }

    const token = generateToken();
    const expiresAt = futureDate(); // By Default 7 Days
    const role = dto.role ?? WorkspaceRole.MEMBER;

    const invitation = await this.prisma.invitation.upsert({
      where: { email_workspaceId: { email: dto.email, workspaceId } },
      create: { email: dto.email, token, workspaceId, role, expiresAt },
      update: { token, role, expiresAt, status: InvitationStatus.PENDING },
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
      to: dto.email,
      inviterName: actor_user?.name ?? "A workspace member",
      workspaceName: workspace?.name ?? "a workspace",
      token,
    }).catch((error) => {
      this.logger.error(
        `Failed to send invitation email to ${dto.email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return invitation;
  }

  async listInvitations(workspaceId: string) {
    return this.prisma.invitation.findMany({
      where: { workspaceId },
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

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.email !== invitation.email) {
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
    const acceptUrl = `${appUrl.replace(/\/+$/, "")}/invitations/accept?token=${
      params.token
    }`;

    const subject = `${params.inviterName} invited you to join "${params.workspaceName}" on TaskForge`;

    const text =
      `${params.inviterName} has invited you to join the "${params.workspaceName}" workspace on TaskForge.\n\n` +
      `Accept your invitation: ${acceptUrl}\n\n` +
      `This invitation expires in 7 days. If you weren't expecting this, you can safely ignore this email.`;

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="margin-bottom: 8px;">You've been invited to TaskForge</h2>
        <p><strong>${params.inviterName}</strong> has invited you to join the
          <strong>${params.workspaceName}</strong> workspace.</p>
        <p style="margin: 24px 0;">
          <a href="${acceptUrl}"
             style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
            Accept invitation
          </a>
        </p>
        <p style="font-size: 13px; color: #666;">
          Or paste this link into your browser:<br />
          <a href="${acceptUrl}">${acceptUrl}</a>
        </p>
        <p style="font-size: 12px; color: #999; margin-top: 24px;">
          This invitation expires in 7 days. If you weren't expecting this, you can safely ignore this email.
        </p>
      </div>
    `;

    await this.mail.sendMail({ to: params.to, subject, text, html });
  }
}

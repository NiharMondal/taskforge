import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InvitationStatus, WorkspaceRole } from "generated/prisma/enums";
import * as crypto from "crypto";
import { SendInvitationDto } from "./dto/send-invitation.dto";

const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationService {
  constructor(private prisma: PrismaService) {}

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
      !(
        [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] as WorkspaceRole[]
      ).includes(actor.role)
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
          "User is already a member of this workspace",
        );
      }
    }

    const pendingInvitation = await this.prisma.invitation.findFirst({
      where: { email: dto.email, workspaceId, status: InvitationStatus.PENDING },
    });

    if (pendingInvitation) {
      throw new ConflictException(
        "A pending invitation already exists for this email",
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS);

    return this.prisma.invitation.create({
      data: {
        email: dto.email,
        token,
        workspaceId,
        role: dto.role ?? WorkspaceRole.MEMBER,
        expiresAt,
      },
    });
  }

  async listInvitations(workspaceId: string) {
    return this.prisma.invitation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
  }

  async cancelInvitation(
    workspaceId: string,
    invitationId: string,
    actorUserId: string,
  ) {
    const actor = await this.prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: actorUserId, workspaceId } },
    });

    if (
      !actor ||
      !(
        [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] as WorkspaceRole[]
      ).includes(actor.role)
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
      throw new BadRequestException("Only pending invitations can be cancelled");
    }

    return this.prisma.invitation.delete({ where: { id: invitationId } });
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
        "Invitation has already been used or cancelled",
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
      throw new ConflictException(
        "You are already a member of this workspace",
      );
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

      return membership;
    });
  }
}

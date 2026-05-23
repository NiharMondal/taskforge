import { PrismaService } from "@/prisma/prisma.service";
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";

@Injectable()
export class MembershipService {
  constructor(private prisma: PrismaService) {}
  async findAllByWorkspaceId(workspaceId: string) {
    return this.prisma.membership.findMany({
      where: { workspaceId },
    });
  }

  // get single member
  async findOne(workspaceId: string, userId: string) {
    const member = await this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException("Member not found");
    }

    return member;
  }
  async updateRole(
    workspaceId: string,
    targetUserId: string,
    actorUserId: string,
    role: WorkspaceRole,
  ) {
    const actor = await this.getMembership(workspaceId, actorUserId);

    if (
      !actor ||
      !([WorkspaceRole.OWNER, WorkspaceRole.ADMIN] as WorkspaceRole[]).includes(
        actor.role,
      )
    ) {
      throw new ForbiddenException("Insufficient permissions");
    }

    if (targetUserId === actorUserId) {
      throw new ForbiddenException("You cannot change your own role");
    }

    const targetMember = await this.getMembership(workspaceId, targetUserId);

    if (!targetMember) {
      throw new NotFoundException("Target member not found");
    }

    // prevent modifying OWNER
    if (targetMember.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException("Cannot modify OWNER role");
    }

    // ADMIN cannot assign OWNER
    if (role === WorkspaceRole.OWNER) {
      throw new ForbiddenException(
        "Use transferOwnership API instead of assigning OWNER role",
      );
    }

    return this.prisma.membership.update({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId,
        },
      },
      data: { role },
    });
  }

  async removeMember(workspaceId: string, targetUserId: string) {
    const targetMember = await this.getMembership(workspaceId, targetUserId);
    if (!targetMember) {
      throw new NotFoundException("Member not found");
    }
    // prevent OWNER demotion edge case
    if (targetMember.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException("Cannot remove OWNER");
    }

    return this.prisma.membership.delete({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId,
        },
      },
    });
  }

  // internal helper
  private async getMembership(workspaceId: string, userId: string) {
    return this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });
  }
}

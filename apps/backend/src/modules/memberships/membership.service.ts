import {
  accessFromMembership,
  assertActorHolds,
  ASSIGNED_ROLE_INCLUDE,
  WorkspaceAccess,
} from "@/common/permissions/workspace-access";
import { PrismaService } from "@/prisma/prisma.service";
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";
import { findSystemRole } from "../roles/system-roles";

/** The role a roster row or `/memberships/me` shows next to the enum. */
const ASSIGNED_ROLE_SUMMARY = {
  assignedRole: { select: { id: true, name: true, systemKey: true } },
} as const;

@Injectable()
export class MembershipService {
  constructor(private prisma: PrismaService) {}
  async findAllByWorkspaceId(workspaceId: string) {
    return this.prisma.membership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            email: true,
          },
        },
        ...ASSIGNED_ROLE_SUMMARY,
      },
    });
  }

  /** The caller's own role and the permissions it grants in this workspace. */
  async getMine(access: WorkspaceAccess) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: access.userId,
          workspaceId: access.workspaceId,
        },
      },
      include: ASSIGNED_ROLE_SUMMARY,
    });

    if (!membership) {
      throw new NotFoundException("Member not found");
    }

    return {
      userId: access.userId,
      workspaceId: access.workspaceId,
      role: membership.role,
      assignedRole: membership.assignedRole,
      permissions: [...access.permissions],
    };
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

  /**
   * `member:manage` is checked on the route. On top of it: nobody changes their
   * own role, the OWNER is untouchable, and an actor may neither act on a
   * member nor hand out a role that holds permissions the actor lacks.
   */
  async updateRole(
    workspaceId: string,
    targetUserId: string,
    actor: WorkspaceAccess,
    role: WorkspaceRole,
  ) {
    if (targetUserId === actor.userId) {
      throw new ForbiddenException("You cannot change your own role");
    }

    const target = await this.getTarget(workspaceId, targetUserId, actor);

    if (role === WorkspaceRole.OWNER) {
      throw new ForbiddenException(
        "Use transferOwnership API instead of assigning OWNER role",
      );
    }

    const newRole = await findSystemRole(this.prisma, workspaceId, role);
    assertActorHolds(
      actor,
      newRole.permissions,
      "assign a role with more access",
    );

    return this.prisma.membership.update({
      where: {
        userId_workspaceId: {
          userId: target.userId,
          workspaceId,
        },
      },
      data: { role, roleId: newRole.id },
    });
  }

  async removeMember(
    workspaceId: string,
    targetUserId: string,
    actor: WorkspaceAccess,
  ) {
    await this.getTarget(workspaceId, targetUserId, actor);

    return this.prisma.membership.delete({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId,
        },
      },
    });
  }

  /**
   * The member an actor wants to change or remove: 404 if absent, 403 if it is
   * the OWNER or holds permissions the actor doesn't.
   */
  private async getTarget(
    workspaceId: string,
    targetUserId: string,
    actor: WorkspaceAccess,
  ) {
    const target = await this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId,
        },
      },
      include: ASSIGNED_ROLE_INCLUDE,
    });

    if (!target) {
      throw new NotFoundException("Member not found");
    }

    const targetAccess = accessFromMembership(target, {
      workspaceId,
      userId: targetUserId,
    });

    if (targetAccess.isOwner) {
      throw new ForbiddenException("Cannot modify or remove the OWNER");
    }

    assertActorHolds(
      actor,
      targetAccess.permissions,
      "manage a member with more access",
    );

    return target;
  }
}

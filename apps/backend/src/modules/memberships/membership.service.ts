import {
  accessFromMembership,
  assertActorHolds,
  assertActorOutranks,
  ASSIGNED_ROLE_INCLUDE,
  WorkspaceAccess,
} from "@/common/permissions/workspace-access";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import PrismaQueryBuilder from "@/lib/PrismQueryBuilder";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";
import {
  findSystemRole,
  resolveAssignableRole,
  type RoleChoice,
} from "../roles/system-roles";

/** The role a roster row or `/memberships/me` shows next to the enum. */
const ASSIGNED_ROLE_SUMMARY = {
  assignedRole: { select: { id: true, name: true, systemKey: true } },
} as const;

@Injectable()
export class MembershipService {
  constructor(private prisma: PrismaService) {}
  /** The roster, longest-standing members first. */
  async findAllByWorkspaceId(workspaceId: string, query: PaginationQueryDto) {
    return new PrismaQueryBuilder(query, {
      defaultField: "createdAt",
      defaultOrder: "asc",
    })
      .withDefaultFilter({ workspaceId })
      .paginate()
      .sort()
      .include({
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            email: true,
          },
        },
        ...ASSIGNED_ROLE_SUMMARY,
      })
      .execute(this.prisma.membership);
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
   * own role, the OWNER is untouchable, an actor may only act on a member
   * with strictly less access than their own (so Admins can't demote each
   * other), and may not hand out a role that holds permissions the actor
   * lacks. The role may be custom (`roleId`); the enum column then reads
   * MEMBER.
   */
  async updateRole(
    workspaceId: string,
    targetUserId: string,
    actor: WorkspaceAccess,
    choice: RoleChoice,
  ) {
    if (targetUserId === actor.userId) {
      throw new ForbiddenException("You cannot change your own role");
    }

    const target = await this.getTarget(workspaceId, targetUserId, actor);

    const newRole = await resolveAssignableRole(
      this.prisma,
      workspaceId,
      choice,
    );
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
      data: { role: newRole.enumRole, roleId: newRole.id },
      include: ASSIGNED_ROLE_SUMMARY,
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
   * Hand the workspace to another member: they become OWNER and the caller,
   * the current OWNER, becomes ADMIN — in one transaction, so the workspace
   * never has no owner or two. `workspace:transfer` (OWNER only) is checked on
   * the route.
   */
  async transferOwnership(
    workspaceId: string,
    actor: WorkspaceAccess,
    newOwnerId: string,
  ) {
    if (newOwnerId === actor.userId) {
      throw new BadRequestException("You already own this workspace");
    }

    const ownerRole = await findSystemRole(
      this.prisma,
      workspaceId,
      WorkspaceRole.OWNER,
    );
    const adminRole = await findSystemRole(
      this.prisma,
      workspaceId,
      WorkspaceRole.ADMIN,
    );

    return this.prisma.$transaction(async (tx) => {
      // Step down only while still the owner: of two transfers racing, the
      // second finds no OWNER row for the caller and changes nothing.
      const steppedDown = await tx.membership.updateMany({
        where: { workspaceId, userId: actor.userId, role: WorkspaceRole.OWNER },
        data: { role: WorkspaceRole.ADMIN, roleId: adminRole.id },
      });
      if (steppedDown.count !== 1) {
        throw new ConflictException("You no longer own this workspace");
      }

      const promoted = await tx.membership.updateMany({
        where: { workspaceId, userId: newOwnerId },
        data: { role: WorkspaceRole.OWNER, roleId: ownerRole.id },
      });
      if (promoted.count !== 1) {
        // Throwing rolls the step-down back too.
        throw new NotFoundException("Member not found");
      }

      return tx.membership.findUnique({
        where: { userId_workspaceId: { userId: newOwnerId, workspaceId } },
        include: ASSIGNED_ROLE_SUMMARY,
      });
    });
  }

  /**
   * The caller leaves the workspace. The OWNER can't — they transfer it or
   * delete it first — and nobody leaves their only workspace, because the app
   * needs one to land in (the same reason deleting your last one isn't offered).
   */
  async leave(actor: WorkspaceAccess) {
    if (actor.isOwner) {
      throw new ForbiddenException(
        "The owner can't leave. Transfer ownership or delete the workspace instead.",
      );
    }

    const memberships = await this.prisma.membership.count({
      where: { userId: actor.userId },
    });
    if (memberships <= 1) {
      throw new BadRequestException("You can't leave your only workspace");
    }

    return this.prisma.membership.delete({
      where: {
        userId_workspaceId: {
          userId: actor.userId,
          workspaceId: actor.workspaceId,
        },
      },
    });
  }

  /**
   * The member an actor wants to change or remove: 404 if absent, 403 if it is
   * the OWNER or the actor doesn't hold strictly more access than they do.
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

    assertActorOutranks(actor, targetAccess.permissions);

    return target;
  }
}

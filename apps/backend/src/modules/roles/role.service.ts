import {
  GRANTABLE_PERMISSIONS,
  isGrantablePermission,
} from "@taskforge/shared";
import {
  assertActorHolds,
  WorkspaceAccess,
} from "@/common/permissions/workspace-access";
import { assertCanCreateCustomRole } from "@/common/plans/plan-limits";
import { PrismaService } from "@/prisma/prisma.service";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InvitationStatus, WorkspaceRole } from "generated/prisma/enums";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";

/** Built-ins first, most access first; custom roles follow by name. */
const SYSTEM_ORDER: WorkspaceRole[] = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
  WorkspaceRole.VIEWER,
];

const rank = (systemKey: WorkspaceRole | null) =>
  systemKey ? SYSTEM_ORDER.indexOf(systemKey) : SYSTEM_ORDER.length;

/** A permission list in catalog order, whatever order it was sent in. */
const inCatalogOrder = (permissions: readonly string[]) =>
  GRANTABLE_PERMISSIONS.filter((p) => permissions.includes(p));

/**
 * The workspace's roles (`spec/role-spec.md`). The four built-ins are
 * read-only: their permissions are the catalog defaults, which later
 * migrations extend by `systemKey`. Custom roles are created, edited and
 * deleted here; members get one through `PATCH /memberships/:userId` or an
 * invitation, by `roleId`.
 *
 * Nobody creates, changes, deletes or hands out a role holding a permission
 * they don't hold themselves (`assertActorHolds`).
 */
@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

  /**
   * Every role with its permissions and how many members hold it. The
   * owner's stored list is empty (the owner holds everything in code), so it
   * is reported as the whole catalog.
   */
  async findAll(workspaceId: string) {
    const roles = await this.prisma.role.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      include: { _count: { select: { memberships: true } } },
    });

    return roles
      .sort((a, b) => rank(a.systemKey) - rank(b.systemKey))
      .map(({ _count, ...role }) => ({
        id: role.id,
        name: role.name,
        systemKey: role.systemKey,
        permissions:
          role.systemKey === WorkspaceRole.OWNER
            ? [...GRANTABLE_PERMISSIONS]
            : inCatalogOrder(role.permissions.filter(isGrantablePermission)),
        memberCount: _count.memberships,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      }));
  }

  async create(
    workspaceId: string,
    actor: WorkspaceAccess,
    dto: CreateRoleDto,
  ) {
    assertActorHolds(actor, dto.permissions, "create a role with more access");
    // Only creating is a Pro feature: a workspace back on Free keeps editing,
    // assigning and deleting the custom roles it has.
    await assertCanCreateCustomRole(this.prisma, workspaceId);
    await this.assertNameFree(workspaceId, dto.name);

    return this.prisma.role.create({
      data: {
        workspaceId,
        name: dto.name,
        permissions: inCatalogOrder(dto.permissions),
      },
    });
  }

  async update(
    workspaceId: string,
    roleId: string,
    actor: WorkspaceAccess,
    dto: UpdateRoleDto,
  ) {
    const role = await this.findCustom(workspaceId, roleId, actor);
    if (dto.permissions) {
      assertActorHolds(actor, dto.permissions, "give a role more access");
    }
    if (dto.name !== undefined) {
      await this.assertNameFree(workspaceId, dto.name, role.id);
    }

    return this.prisma.role.update({
      where: { id: role.id },
      data: {
        name: dto.name,
        permissions: dto.permissions && inCatalogOrder(dto.permissions),
      },
    });
  }

  /**
   * Only an unused role can go: members holding it, or invitations still
   * waiting to be accepted with it, must be moved or revoked first. Used-up
   * invitations (accepted, revoked, expired) just lose the link.
   */
  async remove(workspaceId: string, roleId: string, actor: WorkspaceAccess) {
    const role = await this.findCustom(workspaceId, roleId, actor);

    return this.prisma.$transaction(async (tx) => {
      const members = await tx.membership.count({ where: { roleId } });
      if (members > 0) {
        throw new ConflictException(
          `${members} ${members === 1 ? "member has" : "members have"} this role. Give them another role first.`,
        );
      }

      const pending = await tx.invitation.count({
        where: {
          roleId,
          status: InvitationStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
      });
      if (pending > 0) {
        throw new ConflictException(
          `${pending} pending ${pending === 1 ? "invitation uses" : "invitations use"} this role. Revoke ${pending === 1 ? "it" : "them"} first.`,
        );
      }

      await tx.invitation.updateMany({
        where: { roleId },
        data: { roleId: null },
      });
      return tx.role.delete({ where: { id: role.id } });
    });
  }

  /**
   * A custom role of this workspace that the actor may change: 404 if absent,
   * 403 if built-in or holding a permission the actor lacks.
   */
  private async findCustom(
    workspaceId: string,
    roleId: string,
    actor: WorkspaceAccess,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, workspaceId },
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }
    if (role.systemKey) {
      throw new ForbiddenException(
        "Built-in roles can't be changed. Create a custom role instead.",
      );
    }

    assertActorHolds(
      actor,
      role.permissions.filter(isGrantablePermission),
      "change a role with more access",
    );
    return role;
  }

  /**
   * `@@unique([workspaceId, name])` is case-sensitive, so "Admin" and "admin"
   * would both pass it; refuse that here with a readable message.
   */
  private async assertNameFree(
    workspaceId: string,
    name: string,
    exceptRoleId?: string,
  ) {
    const taken = await this.prisma.role.findFirst({
      where: {
        workspaceId,
        name: { equals: name, mode: "insensitive" },
        ...(exceptRoleId && { id: { not: exceptRoleId } }),
      },
      select: { id: true },
    });

    if (taken) {
      throw new ConflictException(`A role named "${name}" already exists`);
    }
  }
}

import {
  DEFAULT_ROLE_PERMISSIONS,
  GrantablePermission,
  isGrantablePermission,
  SYSTEM_ROLE_NAMES,
} from "@taskforge/shared";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "generated/prisma/client";
import { WorkspaceRole } from "generated/prisma/enums";

type Db = Pick<Prisma.TransactionClient, "role">;

/**
 * Create the four built-in roles of a new workspace and return their ids by
 * key. Every path that creates a workspace calls this in the same transaction,
 * then gives the creator the OWNER role.
 */
export async function seedSystemRoles(
  db: Db,
  workspaceId: string,
): Promise<Record<WorkspaceRole, string>> {
  const roles = await db.role.createManyAndReturn({
    data: Object.values(WorkspaceRole).map((key) => ({
      workspaceId,
      name: SYSTEM_ROLE_NAMES[key],
      systemKey: key,
      permissions: [...DEFAULT_ROLE_PERMISSIONS[key]],
    })),
    select: { id: true, systemKey: true },
  });

  return Object.fromEntries(
    roles.map((role) => [role.systemKey, role.id]),
  ) as Record<WorkspaceRole, string>;
}

/**
 * A workspace's built-in role, for writes that still name a role by its enum
 * (`{ role: "ADMIN" }`). If the workspace has no Role rows yet, `id` is null
 * (the enum column stays the source, as for rows predating roles) and the
 * permissions are the defaults.
 */
export async function findSystemRole(
  db: Db,
  workspaceId: string,
  systemKey: WorkspaceRole,
): Promise<{
  id: string | null;
  name: string;
  permissions: readonly GrantablePermission[];
}> {
  const role = await db.role.findFirst({
    where: { workspaceId, systemKey },
    select: { id: true, name: true, permissions: true },
  });

  return role
    ? {
        id: role.id,
        name: role.name,
        permissions: role.permissions.filter(isGrantablePermission),
      }
    : {
        id: null,
        name: SYSTEM_ROLE_NAMES[systemKey],
        permissions: DEFAULT_ROLE_PERMISSIONS[systemKey],
      };
}

/** How a write names the role to hand out: a Role row, or a built-in by key. */
export type RoleChoice = { roleId?: string; role?: WorkspaceRole };

/**
 * The role a membership change or invitation hands out, from either a
 * `roleId` (any role of this workspace, custom ones included) or the enum of
 * a built-in. Never the owner's: ownership moves only by transfer.
 *
 * `enumRole` is what to write in the legacy `role` column: the built-in's key,
 * or MEMBER for a custom role (permissions always come from the Role row).
 */
export async function resolveAssignableRole(
  db: Db,
  workspaceId: string,
  choice: RoleChoice,
): Promise<{
  id: string | null;
  name: string;
  enumRole: WorkspaceRole;
  permissions: readonly GrantablePermission[];
}> {
  if (choice.roleId !== undefined && choice.role !== undefined) {
    throw new BadRequestException("Send either roleId or role, not both");
  }
  if (choice.roleId === undefined && choice.role === undefined) {
    throw new BadRequestException("Send the role to assign (roleId)");
  }

  if (choice.roleId !== undefined) {
    const role = await db.role.findFirst({
      where: { id: choice.roleId, workspaceId },
      select: { id: true, name: true, systemKey: true, permissions: true },
    });
    if (!role) throw new NotFoundException("Role not found");
    assertNotOwnerRole(role.systemKey);
    return {
      id: role.id,
      name: role.name,
      enumRole: role.systemKey ?? WorkspaceRole.MEMBER,
      permissions: role.permissions.filter(isGrantablePermission),
    };
  }

  const key = choice.role as WorkspaceRole;
  assertNotOwnerRole(key);
  const role = await findSystemRole(db, workspaceId, key);
  return { ...role, enumRole: key };
}

function assertNotOwnerRole(systemKey: WorkspaceRole | null) {
  if (systemKey === WorkspaceRole.OWNER) {
    throw new ForbiddenException(
      "The owner role can't be assigned; the owner transfers it with POST /memberships/transfer-ownership",
    );
  }
}

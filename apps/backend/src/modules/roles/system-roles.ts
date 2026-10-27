import {
  DEFAULT_ROLE_PERMISSIONS,
  GrantablePermission,
  isGrantablePermission,
  SYSTEM_ROLE_NAMES,
} from "@/common/permissions/permissions";
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
): Promise<{ id: string | null; permissions: readonly GrantablePermission[] }> {
  const role = await db.role.findFirst({
    where: { workspaceId, systemKey },
    select: { id: true, permissions: true },
  });

  return role
    ? {
        id: role.id,
        permissions: role.permissions.filter(isGrantablePermission),
      }
    : { id: null, permissions: DEFAULT_ROLE_PERMISSIONS[systemKey] };
}

import { PrismaService } from "@/prisma/prisma.service";
import { ForbiddenException } from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";
import { AuthenticatedRequest } from "../types/authenticated-request.interface";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  isGrantablePermission,
  Permission,
} from "@taskforge/shared";

/** Who the caller is inside the workspace named by the request. */
export interface WorkspaceAccess {
  workspaceId: string;
  userId: string;
  /** The caller's Role row; null only for memberships predating roles. */
  roleId: string | null;
  /** Which built-in role it is, or null for a custom role. */
  systemKey: WorkspaceRole | null;
  isOwner: boolean;
  permissions: ReadonlySet<Permission>;
}

type MembershipWithRole = {
  role: WorkspaceRole;
  roleId: string | null;
  assignedRole: {
    systemKey: WorkspaceRole | null;
    permissions: string[];
  } | null;
};

/** Every membership read that feeds `accessFromMembership` selects this. */
export const ASSIGNED_ROLE_INCLUDE = {
  assignedRole: { select: { systemKey: true, permissions: true } },
} as const;

/**
 * The permissions a membership grants. The OWNER holds everything regardless of
 * what is stored; unknown stored keys (e.g. one later removed from the catalog)
 * are ignored. A membership with no Role row yet falls back to the defaults of
 * its enum role, which the migration seeded identically.
 */
export function accessFromMembership(
  membership: MembershipWithRole,
  ids: { workspaceId: string; userId: string },
): WorkspaceAccess {
  const systemKey = membership.assignedRole
    ? membership.assignedRole.systemKey
    : membership.role;
  const isOwner = systemKey === WorkspaceRole.OWNER;

  const stored = membership.assignedRole
    ? membership.assignedRole.permissions.filter(isGrantablePermission)
    : DEFAULT_ROLE_PERMISSIONS[membership.role];

  return {
    ...ids,
    roleId: membership.roleId,
    systemKey,
    isOwner,
    permissions: new Set<Permission>(isOwner ? ALL_PERMISSIONS : stored),
  };
}

/**
 * Resolve (once per request) the caller's membership in the workspace named by
 * the `x-workspace-id` header or `:workspaceId` param, and attach it as
 * `request.access` / `request.workspaceId`. Shared by WorkspaceGuard and
 * PermissionsGuard so it doesn't matter which of them runs first.
 */
export async function resolveWorkspaceAccess(
  prisma: PrismaService,
  request: AuthenticatedRequest,
): Promise<WorkspaceAccess> {
  if (request.access) return request.access;

  const user = request.user;
  if (!user) {
    throw new ForbiddenException("User not authenticated");
  }

  const rawHeader = request.headers["x-workspace-id"];
  const headerId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  const paramId = request.params["workspaceId"] as string | undefined;

  // Membership is checked against exactly one id, and the route acts on the
  // path param. If the two disagree the check would authorize workspace A
  // while the handler operates on workspace B, so reject instead of guessing.
  if (headerId && paramId && headerId !== paramId) {
    throw new ForbiddenException(
      "x-workspace-id header does not match the workspace in the path",
    );
  }

  const workspaceId = headerId ?? paramId;

  if (!workspaceId) {
    throw new ForbiddenException("Workspace ID missing");
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: user.sub, workspaceId } },
    include: ASSIGNED_ROLE_INCLUDE,
  });

  if (!membership) {
    throw new ForbiddenException("No access to this workspace");
  }

  const access = accessFromMembership(membership, {
    workspaceId,
    userId: user.sub,
  });
  request.workspaceId = workspaceId;
  request.access = access;
  return access;
}

/**
 * Refuse unless the actor holds every one of `permissions` — nobody can hand
 * out (via a role change or an invitation) or act on more access than their
 * own.
 */
export function assertActorHolds(
  actor: WorkspaceAccess,
  permissions: Iterable<string>,
  action: string,
) {
  const held: ReadonlySet<string> = actor.permissions;
  for (const permission of permissions) {
    if (!held.has(permission)) {
      throw new ForbiddenException(`You cannot ${action} than your own`);
    }
  }
}

/**
 * Refuse unless the actor holds every one of the target member's
 * `permissions` and at least one more. Changing or removing a member takes
 * strictly more access than theirs, so peers (two Admins, or two holders of
 * the same custom role) can't demote or remove each other; the OWNER, who
 * alone holds the owner-only keys, outranks everyone.
 */
export function assertActorOutranks(
  actor: WorkspaceAccess,
  permissions: Iterable<string>,
) {
  const held: ReadonlySet<string> = actor.permissions;
  const target = new Set(permissions);
  const holdsAll = [...target].every((permission) => held.has(permission));
  // With every target key held, "one more" is just a larger set.
  if (!holdsAll || held.size <= target.size) {
    throw new ForbiddenException(
      "You can only change or remove a member with less access than your own",
    );
  }
}

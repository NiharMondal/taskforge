import { WorkspaceRole } from "generated/prisma/enums";

/**
 * Everything a workspace role can be granted. A `Role` row stores a subset of
 * these keys; routes declare what they need with `@RequirePermission(...)` and
 * services check finer rules (issue fields, ownership) with `issue-access.ts`.
 *
 * Adding a key: add it here, decide which built-in roles get it in
 * DEFAULT_ROLE_PERMISSIONS, and ship a migration that grants it to existing
 * Role rows — stored roles never pick up new keys on their own.
 */
export const GRANTABLE_PERMISSIONS = [
  /** GET/PATCH /workspaces/:id — rename, edit the description. */
  "workspace:manage",
  /** Create, edit and delete projects. */
  "project:manage",
  /** Create, edit, start and end sprints. */
  "sprint:manage",
  "issue:create",
  "issue:delete",
  /** Content fields (title, description, priority, sprint, assignee) on any issue. */
  "issue:edit:any",
  /** The same fields, on issues the caller reported or is assigned to. */
  "issue:edit:own",
  /** Status and board position on any issue, except setting DONE. */
  "issue:status",
  /** Setting status DONE (on create or update). */
  "issue:status:done",
  /** Change members' roles and remove members. */
  "member:manage",
  /** List, send and revoke invitations. */
  "invitation:manage",
  /** Create, edit and delete roles. */
  "role:manage",
] as const;

/**
 * Held by the workspace OWNER alone and never stored on a role, so no role can
 * be edited into it.
 */
export const OWNER_ONLY_PERMISSIONS = ["workspace:delete"] as const;

export type GrantablePermission = (typeof GRANTABLE_PERMISSIONS)[number];
export type Permission =
  | GrantablePermission
  | (typeof OWNER_ONLY_PERMISSIONS)[number];

export const ALL_PERMISSIONS: readonly Permission[] = [
  ...GRANTABLE_PERMISSIONS,
  ...OWNER_ONLY_PERMISSIONS,
];

const GRANTABLE = new Set<string>(GRANTABLE_PERMISSIONS);

export function isGrantablePermission(key: string): key is GrantablePermission {
  return GRANTABLE.has(key);
}

/**
 * What each built-in role is seeded with — in new workspaces by
 * `seedSystemRoles`, and in existing ones by the `add_workspace_roles`
 * migration (keep the two in step). OWNER's list is stored empty because the
 * owner is granted ALL_PERMISSIONS in code (see `resolveWorkspaceAccess`).
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<
  WorkspaceRole,
  readonly GrantablePermission[]
> = {
  [WorkspaceRole.OWNER]: [],
  [WorkspaceRole.ADMIN]: GRANTABLE_PERMISSIONS,
  [WorkspaceRole.MEMBER]: ["issue:create", "issue:edit:own", "issue:status"],
  [WorkspaceRole.VIEWER]: [],
};

/** Display names of the built-in roles (match the web app's labels). */
export const SYSTEM_ROLE_NAMES: Record<WorkspaceRole, string> = {
  [WorkspaceRole.OWNER]: "Owner",
  [WorkspaceRole.ADMIN]: "Admin",
  [WorkspaceRole.MEMBER]: "Member",
  [WorkspaceRole.VIEWER]: "Viewer",
};

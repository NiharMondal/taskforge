import type { WorkspaceRole } from "./enums";

/**
 * Everything a workspace role can be granted, in the order the API returns
 * them. A `Role` row stores a subset of these keys; backend routes declare
 * what they need with `@RequirePermission(...)` and services check finer rules
 * (issue fields, ownership) with `issue-access.ts`. The web's role editor
 * lists them (its labels live in `features/roles/constants.ts`, which must
 * cover every key) and its permission flags read them.
 *
 * Adding a key: add it here, decide which built-in roles get it in
 * DEFAULT_ROLE_PERMISSIONS, ship a backend migration that grants it to
 * existing Role rows — stored roles never pick up new keys on their own — and
 * give it a label in the web's PERMISSION_GROUPS.
 */
export const GRANTABLE_PERMISSIONS = [
  /** PATCH /workspaces/:id — rename, edit the description. */
  "workspace:manage",
  /** Create, edit and delete projects. */
  "project:manage",
  /** Create, rename, recolor and delete the workspace's labels. */
  "label:manage",
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
  /** Comment on issues, and edit or delete your own comments. */
  "comment:create",
  /** Delete anyone's comment (moderation). */
  "comment:delete:any",
  /** Change members' roles and remove members. */
  "member:manage",
  /** List, send and revoke invitations. */
  "invitation:manage",
  /** Create, edit and delete roles. */
  "role:manage",
] as const;

/**
 * Held by the workspace OWNER alone and never stored on a role, so no role can
 * be edited into it — and adding one needs no migration.
 */
export const OWNER_ONLY_PERMISSIONS = [
  "workspace:delete",
  /** Hand the workspace to another member (`POST /memberships/transfer-ownership`). */
  "workspace:transfer",
  /** Start a Pro checkout and open the Stripe billing portal (`/billing/*`). */
  "billing:manage",
] as const;

export type GrantablePermission = (typeof GRANTABLE_PERMISSIONS)[number];
export type OwnerOnlyPermission = (typeof OWNER_ONLY_PERMISSIONS)[number];
export type Permission = GrantablePermission | OwnerOnlyPermission;

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
 * `seedSystemRoles`, and in existing ones by the backend's `add_workspace_roles`
 * migration plus the migrations that granted later keys
 * (`comment_permissions`, `label_permissions`); keep them in step. OWNER's
 * list is stored empty because the owner is granted ALL_PERMISSIONS in code
 * (see `resolveWorkspaceAccess`).
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<
  WorkspaceRole,
  readonly GrantablePermission[]
> = {
  OWNER: [],
  ADMIN: GRANTABLE_PERMISSIONS,
  MEMBER: [
    "issue:create",
    "issue:edit:own",
    "issue:status",
    "comment:create",
  ],
  VIEWER: [],
};

/** Display names of the built-in roles. */
export const SYSTEM_ROLE_NAMES: Record<WorkspaceRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

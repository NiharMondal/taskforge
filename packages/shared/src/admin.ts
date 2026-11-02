import type { PlatformRole } from "./enums";

/**
 * The platform admin console's contract (`apps/backend/spec/admin-spec.md`):
 * suspension error codes, field limits and the platform audit log's
 * vocabulary, shared by the backend that writes them and the web that shows
 * them.
 */

/**
 * `code` on the 403 body when a suspended account signs in, verifies an email
 * or refreshes its session.
 */
export const ACCOUNT_SUSPENDED_ERROR_CODE = "ACCOUNT_SUSPENDED";

/** `code` on the 403 body for any workspace-scoped request to a suspended workspace. */
export const WORKSPACE_SUSPENDED_ERROR_CODE = "WORKSPACE_SUSPENDED";

/** The longest reason an admin action takes. */
export const MAX_ADMIN_REASON_LENGTH = 500;

/** The longest `?search=` the admin lists accept. */
export const MAX_ADMIN_SEARCH_LENGTH = 200;

/** What a platform audit row is about. */
export const PLATFORM_AUDIT_TARGET_TYPES = ["USER", "WORKSPACE"] as const;
export type PlatformAuditTargetType =
  (typeof PLATFORM_AUDIT_TARGET_TYPES)[number];

/** A user as a platform audit row names them, copied in so it survives a delete. */
export type PlatformAuditUserRef = {
  name: string;
  email: string;
};

/** Each platform action and the `metadata` its row carries. */
export interface PlatformAuditMetadata {
  /** Granted, changed or removed by the `set-platform-role` script (no actor). */
  "platform_role.changed": {
    email: string;
    from: PlatformRole | null;
    to: PlatformRole | null;
  };
  "user.suspended": PlatformAuditUserRef & { reason: string };
  "user.unsuspended": PlatformAuditUserRef & { reason: string };
  /** `revoked`: how many still-usable sessions it ended. */
  "user.sessions_revoked": PlatformAuditUserRef & {
    reason: string;
    revoked: number;
  };
  /** `deletedWorkspaces`: the workspaces only they belonged to, deleted with them. */
  "user.deleted": PlatformAuditUserRef & {
    reason: string;
    deletedWorkspaces: { id: string; name: string }[];
  };
  "workspace.suspended": { name: string; reason: string };
  "workspace.unsuspended": { name: string; reason: string };
  "workspace.deleted": {
    name: string;
    reason: string;
    owner: (PlatformAuditUserRef & { id: string }) | null;
    memberCount: number;
  };
}

export type PlatformAuditAction = keyof PlatformAuditMetadata;

/** The target type each action's row carries. */
export const PLATFORM_AUDIT_ACTION_TARGET: Record<
  PlatformAuditAction,
  PlatformAuditTargetType
> = {
  "platform_role.changed": "USER",
  "user.suspended": "USER",
  "user.unsuspended": "USER",
  "user.sessions_revoked": "USER",
  "user.deleted": "USER",
  "workspace.suspended": "WORKSPACE",
  "workspace.unsuspended": "WORKSPACE",
  "workspace.deleted": "WORKSPACE",
};

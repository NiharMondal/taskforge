/**
 * Workspace domain types.
 *
 * Derived from the Prisma `Workspace` and `Membership` models
 * (.claude/schema.prisma). Per AI_GUIDE ("Never Guess API") these mirror the
 * backend models exactly — extend them only when a real contract is documented.
 */

/** Mirrors the Prisma `WorkspaceRole` enum. */
export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

/** A tenant root the current user belongs to. */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

/** The user's membership in a workspace, carrying their RBAC role. */
export interface WorkspaceMembership {
  workspace: Workspace;
  role: WorkspaceRole;
}

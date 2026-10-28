/**
 * Workspace domain types.
 *
 * Derived from the Prisma `Workspace` and `Membership` models
 * (apps/backend/prisma/schema.prisma). Per AI_GUIDE ("Never Guess API") these mirror the
 * backend models exactly — extend them only when a real contract is documented.
 */

import type { WorkspaceRole } from "@taskforge/shared";

/** The Prisma `WorkspaceRole` enum (via `@taskforge/shared`). */
export type { WorkspaceRole };

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

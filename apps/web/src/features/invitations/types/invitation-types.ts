import type { InvitationStatus } from "@taskforge/shared";
import type { RoleSummary } from "@/features/roles/types/role-types";
import type { WorkspaceRole } from "@/features/workspace/types/workspace-types";

/**
 * Invitation domain types. Mirrors the Prisma `Invitation` model
 * (apps/backend/prisma/schema.prisma) — an email invited into a workspace.
 *
 * The `token` is intentionally omitted: list responses must never expose it
 * (it grants membership) and the accept flow receives it via the email link.
 */

/** The Prisma `InvitationStatus` enum (via `@taskforge/shared`). */
export type { InvitationStatus };

export interface Invitation {
  id: string;
  email: string;
  workspaceId: string;
  /** Legacy enum (MEMBER for a custom role); show `assignedRole`. */
  role: WorkspaceRole;
  roleId: string | null;
  /** The role it grants; null once a deleted role was unlinked. */
  assignedRole: RoleSummary | null;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload of `POST /invitations/accept` — the Membership created for the
 * accepting user. The frontend only relies on `workspaceId` (to switch the
 * active tenant); the other fields stay optional so we fail soft if the
 * contract differs.
 */
export interface AcceptInvitationResult {
  id?: string;
  userId?: string;
  workspaceId: string;
  role?: WorkspaceRole;
}

/**
 * Payload of the public `GET /invitations/validate?token=` — what the accept
 * page shows before the invitee commits. Only returned for a PENDING,
 * unexpired token; anything else is a 4xx.
 */
export interface InvitationPreview {
  email: string;
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
  /** The role's display name (custom roles included). */
  roleName: string;
  expiresAt: string;
}

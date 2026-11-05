import type { Permission } from "@taskforge/shared";
import type { RoleSummary } from "@/features/roles/types/role-types";
import type { WorkspaceRole } from "@/features/workspace/types/workspace-types";
import { ICommonUserEntity } from "@/types/common";

/**
 * Membership domain types. Mirrors the Prisma `Membership` model
 * (apps/backend/prisma/schema.prisma) — a user's seat in the active workspace.
 *
 * The embedded `user` is marked optional: the dashboard only needs the member
 * count, and AI_GUIDE forbids assuming fields the contract hasn't confirmed.
 */

/** The user embedded in a roster row (`GET /memberships`), with their email. */
export interface MemberUser extends ICommonUserEntity {
	email?: string;
}

export interface Member {
	id: string;
	userId: string;
	workspaceId: string;
	/**
	 * Legacy enum: the built-in's key, or MEMBER for a custom role. Show
	 * `assignedRole` instead; it is null only for rows predating roles.
	 */
	role: WorkspaceRole;
	assignedRole: RoleSummary | null;
	createdAt: string;
	user: MemberUser | null;
}

/** Payload for `PATCH /memberships/:userId` — the only mutable field is the role. */
export interface UpdateMembershipDto {
	roleId: string;
}

/**
 * `GET /memberships/me`: the caller's role in the workspace and every
 * permission it grants, resolved by the backend (the owner's includes the
 * owner-only keys). The web derives its permission flags from this.
 */
export interface MyMembership {
	userId: string;
	workspaceId: string;
	role: WorkspaceRole;
	assignedRole: RoleSummary | null;
	permissions: Permission[];
}

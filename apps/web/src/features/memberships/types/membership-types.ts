import type { WorkspaceRole } from "@/features/workspace/types/workspace-types";
import { ICommonUserEntity } from "@/types/common";

/**
 * Membership domain types. Mirrors the Prisma `Membership` model
 * (.claude/schema.prisma) — a user's seat in the active workspace.
 *
 * The embedded `user` is marked optional: the dashboard only needs the member
 * count, and AI_GUIDE forbids assuming fields the contract hasn't confirmed.
 */

/**
 * The user embedded in a roster row (`GET /memberships`). The email is not a
 * `User` column — the backend selects it through the `Auth` relation, which is
 * optional in the schema. Read it with `getMemberEmail`, not directly.
 */
export interface MemberUser extends ICommonUserEntity {
	auth?: { email: string } | null;
}

export interface Member {
	id: string;
	userId: string;
	workspaceId: string;
	role: WorkspaceRole;
	createdAt: string;
	user: MemberUser | null;
}

/** Payload for `PATCH /memberships/:userId` — the only mutable field is the role. */
export interface UpdateMembershipDto {
	role: WorkspaceRole;
}

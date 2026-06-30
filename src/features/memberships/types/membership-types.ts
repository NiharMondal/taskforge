import type { WorkspaceRole } from "@/features/workspace/types/workspace-types";
import { ICommonUserEntity } from "@/types/common";

/**
 * Membership domain types. Mirrors the Prisma `Membership` model
 * (.claude/schema.prisma) — a user's seat in the active workspace.
 *
 * The embedded `user` is marked optional: the dashboard only needs the member
 * count, and AI_GUIDE forbids assuming fields the contract hasn't confirmed.
 */
export interface Member {
	id: string;
	userId: string;
	workspaceId: string;
	role: WorkspaceRole;
	createdAt: string;
	user: ICommonUserEntity | null;
}

/** Payload for `PATCH /memberships/:userId` — the only mutable field is the role. */
export interface UpdateMembershipDto {
	role: WorkspaceRole;
}

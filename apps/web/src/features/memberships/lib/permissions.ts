import type { IssueStatus } from "@/features/issues/types/issue-types";
import type { WorkspaceRole } from "@/features/workspace/types/workspace-types";

/**
 * What a workspace role may do, mirroring the backend's rules so the UI can hide
 * or disable controls the API would answer with a 403.
 *
 * This is UX only — the backend stays the authority. Its rules are permissions
 * on each workspace's roles (`@RequirePermission(...)` on routes, field-level
 * issue checks in `issue-access.ts`; catalog in
 * apps/backend/src/common/permissions/permissions.ts).
 *
 * Known drift: these flags still encode the *old* MEMBER rules (status/rank
 * only). The backend now also lets a MEMBER create issues and edit issues they
 * reported or are assigned to, so the UI hides controls the API would allow.
 * The fix is to read `GET /memberships/me` instead of mirroring rules here.
 *
 * While the role is still loading every flag is `false` (no controls flicker in
 * and back out). If it can't be determined once loading has *finished* — roster
 * failed, or the user isn't on it — see {@link UNRESTRICTED_PERMISSIONS}.
 */
export interface Permissions {
	role: WorkspaceRole | undefined;
	/** OWNER or ADMIN. */
	isManager: boolean;
	canCreateIssue: boolean;
	/** Title, description, priority, assignee, sprint. */
	canEditIssueFields: boolean;
	/** Change an issue's status or its board position. */
	canChangeIssueStatus: boolean;
	canMarkIssueDone: boolean;
	canDeleteIssue: boolean;
	canManageProjects: boolean;
	canManageSprints: boolean;
	/** Create, edit and delete the workspace's labels (`label:manage`). */
	canManageLabels: boolean;
	/** Write comments, and edit or delete your own (`comment:create`). */
	canComment: boolean;
	/** Delete anyone's comment (`comment:delete:any`). */
	canDeleteAnyComment: boolean;
	/** OWNER only; the backend never grants `workspace:delete` to a role. */
	canDeleteWorkspace: boolean;
	/** OWNER only (`workspace:transfer`, never grantable). */
	canTransferOwnership: boolean;
	/** Anyone but the OWNER, who must transfer or delete the workspace first. */
	canLeaveWorkspace: boolean;
}

export function getPermissions(role: WorkspaceRole | undefined): Permissions {
	const isManager = role === "OWNER" || role === "ADMIN";
	const isMember = role === "MEMBER";

	return {
		role,
		isManager,
		canCreateIssue: isManager,
		canEditIssueFields: isManager,
		canChangeIssueStatus: isManager || isMember,
		canMarkIssueDone: isManager,
		canDeleteIssue: isManager,
		canManageProjects: isManager,
		canManageSprints: isManager,
		canManageLabels: isManager,
		canComment: isManager || isMember,
		canDeleteAnyComment: isManager,
		canDeleteWorkspace: role === "OWNER",
		canTransferOwnership: role === "OWNER",
		canLeaveWorkspace: !!role && role !== "OWNER",
	};
}

/**
 * Fallback for "everything has loaded but we still can't tell the role". It
 * shows every control instead of locking the user out of their own workspace
 * over a lookup failure; the backend still answers 403 to anything the real role
 * isn't allowed, exactly as it did before the UI was role-aware.
 */
export const UNRESTRICTED_PERMISSIONS: Permissions = {
	...getPermissions("OWNER"),
	role: undefined,
};

/** Whether these permissions allow moving an issue *to* `status`. */
export function canSetIssueStatus(
	permissions: Permissions,
	status: IssueStatus,
): boolean {
	if (!permissions.canChangeIssueStatus) return false;
	return status !== "DONE" || permissions.canMarkIssueDone;
}

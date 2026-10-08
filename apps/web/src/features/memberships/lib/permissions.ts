import type { IssueStatus } from "@/features/issues/types/issue-types";
import type { WorkspaceRole } from "@/features/workspace/types/workspace-types";

/**
 * What a workspace role may do, mirroring the backend's rules so the UI can hide
 * or disable controls the API would answer with a 403.
 *
 * This is UX only — the backend stays the authority. The rules come from:
 *  - projects / sprints / issue create + delete: `@Roles(OWNER, ADMIN)`
 *  - `IssueService.update`: VIEWER rejected outright; MEMBER may change `status`
 *    (never to `DONE`) and `rank` only (apps/backend/spec/issue-spec.md)
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
	canManageProjects: boolean;
	canManageSprints: boolean;
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
		canManageProjects: isManager,
		canManageSprints: isManager,
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

import type { IssueStatus } from "@/features/issues/types/issue-types";
import { ALL_PERMISSIONS, type Permission } from "@taskforge/shared";

/**
 * What the viewer may do in the active workspace, as flags for hiding or
 * disabling controls the API would answer with a 403. Built from the
 * permission keys `GET /memberships/me` returns — the backend resolves the
 * role (built-in or custom) — so there is no copy of the role rules here.
 *
 * This is UX only — the backend stays the authority (`@RequirePermission(...)`
 * on routes, field-level issue checks in `issue-access.ts`).
 *
 * While the role is still loading every flag is `false` (no controls flicker in
 * and back out). If it can't be determined once loading has *finished*, see
 * {@link UNRESTRICTED_PERMISSIONS}.
 */
export interface Permissions {
	/** Every key the viewer holds, for checks such as "may I hand out this role". */
	granted: ReadonlySet<Permission>;
	/** The workspace owner: holds everything, and can't leave. */
	isOwner: boolean;
	/** The viewer's user id, for rules about their own rows. */
	userId: string | undefined;
	/** Rename the workspace, edit its description (`workspace:manage`). */
	canManageWorkspace: boolean;
	/** Change members' roles, remove members (`member:manage`). */
	canManageMembers: boolean;
	/** List, send and revoke invitations (`invitation:manage`). */
	canManageInvitations: boolean;
	/** Create, edit and delete custom roles (`role:manage`). */
	canManageRoles: boolean;
	canCreateIssue: boolean;
	/** Content fields on every issue (`issue:edit:any`); see {@link canEditIssue}. */
	canEditAnyIssue: boolean;
	/** Content fields on issues the viewer reported or is assigned to (`issue:edit:own`). */
	canEditOwnIssues: boolean;
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
	/** OWNER only (`billing:manage`, never grantable): upgrade, open Stripe's portal. */
	canManageBilling: boolean;
	/** Anyone but the OWNER, who must transfer or delete the workspace first. */
	canLeaveWorkspace: boolean;
}

/**
 * Flags from the permission keys the viewer holds. `isOwner` is `undefined`
 * when there is no membership at all (nothing loaded), which is also not
 * allowed to leave.
 */
export function permissionsFrom(
	keys: Iterable<string>,
	{ isOwner, userId }: { isOwner: boolean | undefined; userId: string | undefined },
): Permissions {
	const granted = new Set(keys) as ReadonlySet<Permission>;
	const has = (key: Permission) => granted.has(key);

	return {
		granted,
		isOwner: isOwner === true,
		userId,
		canManageWorkspace: has("workspace:manage"),
		canManageMembers: has("member:manage"),
		canManageInvitations: has("invitation:manage"),
		canManageRoles: has("role:manage"),
		canCreateIssue: has("issue:create"),
		canEditAnyIssue: has("issue:edit:any"),
		canEditOwnIssues: has("issue:edit:own"),
		canChangeIssueStatus: has("issue:status"),
		canMarkIssueDone: has("issue:status:done"),
		canDeleteIssue: has("issue:delete"),
		canManageProjects: has("project:manage"),
		canManageSprints: has("sprint:manage"),
		canManageLabels: has("label:manage"),
		canComment: has("comment:create"),
		canDeleteAnyComment: has("comment:delete:any"),
		canDeleteWorkspace: has("workspace:delete"),
		canTransferOwnership: has("workspace:transfer"),
		canManageBilling: has("billing:manage"),
		canLeaveWorkspace: isOwner === false,
	};
}

/** While loading: nothing is shown yet. */
export const NO_PERMISSIONS = permissionsFrom([], {
	isOwner: undefined,
	userId: undefined,
});

/**
 * Fallback for "everything has loaded but we still can't tell the role". It
 * shows every control instead of locking the user out of their own workspace
 * over a lookup failure; the backend still answers 403 to anything the real role
 * isn't allowed, exactly as it did before the UI was role-aware.
 */
export const UNRESTRICTED_PERMISSIONS = permissionsFrom(
	ALL_PERMISSIONS,
	{ isOwner: true, userId: undefined },
);

/**
 * Whether these permissions allow editing `issue`'s content fields (title,
 * description, priority, type, points, assignee, sprint, labels) — the
 * backend's rule: any issue with `issue:edit:any`, or one the viewer reported
 * or is assigned to with `issue:edit:own`. Ownership is the *saved* issue's.
 */
export function canEditIssue(
	permissions: Permissions,
	issue: { reporterId: string; assigneeId?: string | null },
): boolean {
	if (permissions.canEditAnyIssue) return true;
	const { userId } = permissions;
	return (
		permissions.canEditOwnIssues &&
		!!userId &&
		(issue.reporterId === userId || issue.assigneeId === userId)
	);
}

/** Whether these permissions allow moving an issue *to* `status`. */
export function canSetIssueStatus(
	permissions: Permissions,
	status: IssueStatus,
): boolean {
	if (!permissions.canChangeIssueStatus) return false;
	return status !== "DONE" || permissions.canMarkIssueDone;
}

/**
 * Whether the viewer holds every one of `keys` — the backend's no-escalation
 * rule for handing out or editing a role (`assertActorHolds`).
 */
export function holdsAll(
	permissions: Permissions,
	keys: Iterable<string>,
): boolean {
	const granted: ReadonlySet<string> = permissions.granted;
	for (const key of keys) if (!granted.has(key)) return false;
	return true;
}

/**
 * Whether the viewer holds every one of a member's `keys` and at least one
 * more — the backend's rule for changing or removing a member
 * (`assertActorOutranks`), so an Admin can't act on another Admin.
 */
export function outranks(
	permissions: Permissions,
	keys: Iterable<string>,
): boolean {
	const target = new Set(keys);
	return holdsAll(permissions, target) && permissions.granted.size > target.size;
}

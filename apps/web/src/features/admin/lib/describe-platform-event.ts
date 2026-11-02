import { PLATFORM_ROLE_LABELS } from "../constants";
import type { PlatformAuditEntry, PlatformRole } from "../types/admin-types";

const roleName = (role: PlatformRole | null) =>
	role ? PLATFORM_ROLE_LABELS[role] : "no role";

/**
 * A platform audit row as a sentence about its target, e.g. "suspended
 * sam@example.com". Names come from the row (copied in when it happened), so
 * a deleted user or workspace still reads. A new action needs a case here:
 * the `never` check fails the build otherwise.
 */
export function describePlatformEvent(entry: PlatformAuditEntry): string {
	switch (entry.action) {
		case "platform_role.changed": {
			const { email, from, to } = entry.metadata;
			return `changed ${email}'s platform role from ${roleName(from)} to ${roleName(to)}`;
		}
		case "user.suspended":
			return `suspended ${entry.metadata.email}`;
		case "user.unsuspended":
			return `lifted the suspension of ${entry.metadata.email}`;
		case "user.sessions_revoked": {
			const { email, revoked } = entry.metadata;
			return `signed ${email} out everywhere (${revoked} ${revoked === 1 ? "session" : "sessions"})`;
		}
		case "user.deleted": {
			const { email, deletedWorkspaces } = entry.metadata;
			const extra = deletedWorkspaces.length
				? `, with ${deletedWorkspaces.map((w) => w.name).join(", ")}`
				: "";
			return `deleted the account ${email}${extra}`;
		}
		case "workspace.suspended":
			return `suspended the workspace ${entry.metadata.name}`;
		case "workspace.unsuspended":
			return `lifted the suspension of the workspace ${entry.metadata.name}`;
		case "workspace.deleted": {
			const { name, memberCount } = entry.metadata;
			return `deleted the workspace ${name} (${memberCount} ${memberCount === 1 ? "member" : "members"})`;
		}
		default: {
			const unknown: never = entry;
			return (unknown as { action: string }).action;
		}
	}
}

/** The reason staff gave, when the action takes one. */
export function platformEventReason(entry: PlatformAuditEntry): string | null {
	return "reason" in entry.metadata ? entry.metadata.reason : null;
}

/** Who did it: the staff member, or the CLI script (or a deleted account). */
export function platformActorName(entry: PlatformAuditEntry): string {
	if (entry.actor) return entry.actor.name;
	return entry.action === "platform_role.changed"
		? "set-platform-role script"
		: "Deleted user";
}

/** Where the target lives in the console, while it still exists. */
export function platformTargetHref(entry: PlatformAuditEntry): string | null {
	if (!entry.targetId) return null;
	if (entry.action === "user.deleted" || entry.action === "workspace.deleted") {
		return null;
	}
	return entry.targetType === "USER"
		? `/admin/users/${entry.targetId}`
		: `/admin/workspaces/${entry.targetId}`;
}

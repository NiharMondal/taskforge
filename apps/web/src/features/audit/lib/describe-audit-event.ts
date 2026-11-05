import { PLAN_META, STATUS_LABELS } from "@/features/billing/constants";
import { PERMISSION_GROUPS } from "@/features/roles/constants";
import { DELETED_USER_NAME } from "@/types/common";

import type {
	AuditLogEntry,
	AuditSubscriptionState,
} from "../types/audit-types";

/*
 * Turns an audit row into words. Pure: everything comes from the row, whose
 * metadata holds names as they were then, so nothing needs looking up. The
 * actor is rendered separately ({@link auditActorName}); summaries are the
 * predicate — "changed Bob's role from Member to Admin".
 */

const PERMISSION_LABELS = new Map<string, string>(
	PERMISSION_GROUPS.flatMap((group) =>
		group.permissions.map((p) => [p.key, p.label] as const),
	),
);

/** A permission key's role-editor label, or the key for one it doesn't know. */
const permissionLabel = (key: string) => PERMISSION_LABELS.get(key) ?? key;

const possessive = (name: string) => `${name}’s`;

const planName = (state: AuditSubscriptionState) =>
	PLAN_META[state.plan]?.name ?? state.plan;

/** "Pro (trial)", or just "Free" for a row that never had a Stripe status. */
const subscriptionState = (state: AuditSubscriptionState) =>
	state.status
		? `${planName(state)} (${(STATUS_LABELS[state.status] ?? state.status).toLowerCase()})`
		: planName(state);

/**
 * Who did it. A row without a user is the system (Stripe's webhook) for
 * billing; otherwise the account was deleted since, and for leaving or
 * accepting an invitation the metadata still names who it was.
 */
export function auditActorName(entry: AuditLogEntry): string {
	if (entry.user) return entry.user.name;
	switch (entry.action) {
		case "billing.subscription_changed":
			return "System";
		case "member.left":
			return entry.metadata.member.name;
		case "invitation.accepted":
			return entry.metadata.email;
		default:
			return DELETED_USER_NAME;
	}
}

/** Whether the row was written by the system rather than a person. */
export const isSystemEvent = (entry: AuditLogEntry) =>
	!entry.user && entry.action === "billing.subscription_changed";

/** The row as one sentence, without its actor. */
export function describeAuditEvent(entry: AuditLogEntry): string {
	switch (entry.action) {
		case "member.role_changed": {
			const { member, from, to } = entry.metadata;
			return `changed ${possessive(member.name)} role from ${from.name} to ${to.name}`;
		}
		case "member.removed": {
			const { member, role } = entry.metadata;
			return `removed ${member.name} (${role.name})`;
		}
		case "member.left":
			return "left the workspace";
		case "invitation.sent": {
			const { email, role } = entry.metadata;
			return `invited ${email} as ${role.name}`;
		}
		case "invitation.revoked":
			return `revoked the invitation to ${entry.metadata.email}`;
		case "invitation.accepted":
			return `accepted the invitation (${entry.metadata.role.name})`;
		case "role.created":
			return `created the role ${entry.metadata.role.name}`;
		case "role.updated": {
			const { role, name, permissions } = entry.metadata;
			const parts: string[] = [];
			if (name) parts.push(`renamed the role ${name.from} to ${name.to}`);
			if (permissions) {
				const counts = [
					permissions.added.length && `+${permissions.added.length}`,
					permissions.removed.length && `−${permissions.removed.length}`,
				].filter(Boolean);
				const delta = counts.length ? ` (${counts.join(", ")})` : "";
				parts.push(
					name
						? `changed its permissions${delta}`
						: `changed the role ${possessive(role.name)} permissions${delta}`,
				);
			}
			return parts.length
				? parts.join(" and ")
				: `updated the role ${role.name}`;
		}
		case "role.deleted":
			return `deleted the role ${entry.metadata.role.name}`;
		case "workspace.updated": {
			const { name, description } = entry.metadata;
			if (name && description) {
				return `renamed the workspace from ${name.from} to ${name.to} and updated its description`;
			}
			if (name) return `renamed the workspace from ${name.from} to ${name.to}`;
			if (description) return "updated the workspace description";
			return "updated the workspace";
		}
		case "ownership.transferred": {
			const { from, to } = entry.metadata;
			return `transferred ownership from ${from.name} to ${to.name}`;
		}
		case "billing.subscription_changed":
			return describeSubscriptionChange(entry.metadata);
		default: {
			// An action newer than this build: show its key rather than nothing.
			const unknown: { action: string } = entry;
			return unknown.action;
		}
	}
}

function describeSubscriptionChange({
	from,
	to,
}: {
	from: AuditSubscriptionState | null;
	to: AuditSubscriptionState;
}): string {
	if (!from) return `Subscription started: ${subscriptionState(to)}`;

	const stateChanged = from.plan !== to.plan || from.status !== to.status;
	const cancellation =
		to.cancelAtPeriodEnd && !from.cancelAtPeriodEnd
			? "cancellation scheduled for the end of the period"
			: !to.cancelAtPeriodEnd && from.cancelAtPeriodEnd
				? "cancellation withdrawn"
				: null;

	if (stateChanged) {
		const change = `Subscription: ${subscriptionState(from)} → ${subscriptionState(to)}`;
		return cancellation ? `${change}; ${cancellation}` : change;
	}
	if (cancellation) return `Subscription: ${planName(to)} ${cancellation}`;
	return `Subscription updated: ${subscriptionState(to)}`;
}

/**
 * Detail for a row whose sentence summarizes a list — the permissions a role
 * was created with or gained and lost, by their role-editor labels — or
 * `null`.
 */
export function auditEventDetail(entry: AuditLogEntry): string | null {
	switch (entry.action) {
		case "role.created": {
			const { permissions } = entry.metadata;
			return permissions.length
				? `Permissions: ${permissions.map(permissionLabel).join(", ")}`
				: "No permissions";
		}
		case "role.updated": {
			const { permissions } = entry.metadata;
			if (!permissions) return null;
			const lines = [
				permissions.added.length &&
					`Added: ${permissions.added.map(permissionLabel).join(", ")}`,
				permissions.removed.length &&
					`Removed: ${permissions.removed.map(permissionLabel).join(", ")}`,
			].filter(Boolean);
			return lines.length ? lines.join(" · ") : null;
		}
		default:
			return null;
	}
}

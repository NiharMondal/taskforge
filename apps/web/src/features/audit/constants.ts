import { AUDIT_ENTITY_TYPES } from "@taskforge/shared";

import type { AuditEntityType } from "./types/audit-types";

/** The audit log's filter labels, one per entity type. */
export const AUDIT_ENTITY_LABELS: Record<AuditEntityType, string> = {
	MEMBER: "Members",
	INVITATION: "Invitations",
	ROLE: "Roles",
	WORKSPACE: "Workspace",
	SUBSCRIPTION: "Billing",
};

/** The filter's options, in the shared list's order. */
export const AUDIT_ENTITY_FILTERS = AUDIT_ENTITY_TYPES.map((type) => ({
	type,
	label: AUDIT_ENTITY_LABELS[type],
}));

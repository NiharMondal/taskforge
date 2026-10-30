import type {
	AuditAction,
	AuditEntityType,
	AuditMetadata,
	AuditRef,
	AuditSubscriptionState,
} from "@taskforge/shared";

/** The audit log's vocabulary (via `@taskforge/shared`, which the API writes with). */
export type {
	AuditAction,
	AuditEntityType,
	AuditMetadata,
	AuditRef,
	AuditSubscriptionState,
};

/** Who did it, as `GET /audit-log` embeds them. */
export interface AuditActor {
	id: string;
	name: string;
	avatarUrl: string | null;
}

interface AuditLogEntryBase<A extends AuditAction> {
	id: string;
	action: A;
	entityType: AuditEntityType;
	entityId: string | null;
	metadata: AuditMetadata[A];
	createdAt: string;
	/** `null` for the system (Stripe's webhook) or a deleted account. */
	user: AuditActor | null;
}

/**
 * One row of `GET /audit-log` (apps/backend/src/modules/audit/). A union over
 * the actions, so switching on `action` narrows `metadata`. Names in the
 * metadata are as they were when it happened, so a renamed role or a removed
 * member still reads.
 */
export type AuditLogEntry = {
	[A in AuditAction]: AuditLogEntryBase<A>;
}[AuditAction];

/** The query string `GET /audit-log` accepts. */
export interface AuditLogQuery {
	page?: number;
	limit?: number;
	/** Only rows of this entity type; omitted means all of them. */
	entityType?: AuditEntityType;
}

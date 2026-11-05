import type { SubscriptionPlan, SubscriptionStatus } from "./enums";

/**
 * The workspace audit log: `AuditLog` rows for changes to who is in a
 * workspace and what they may do (issue history is the other kind of row,
 * entity type "ISSUE", and is read per issue instead). The backend writes one
 * row per action, in the transaction of the change (`recordWorkspaceEvent`);
 * `GET /audit-log` reads them with `audit:read`, and the web describes each
 * from its action and metadata.
 */
export const AUDIT_ENTITY_TYPES = [
  "MEMBER",
  "INVITATION",
  "ROLE",
  "WORKSPACE",
  "SUBSCRIPTION",
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/** Each action, and the entity type its rows carry. */
export const AUDIT_ACTION_ENTITY = {
  "member.role_changed": "MEMBER",
  "member.removed": "MEMBER",
  "member.left": "MEMBER",
  "invitation.sent": "INVITATION",
  "invitation.revoked": "INVITATION",
  "invitation.accepted": "INVITATION",
  "role.created": "ROLE",
  "role.updated": "ROLE",
  "role.deleted": "ROLE",
  "workspace.updated": "WORKSPACE",
  "ownership.transferred": "WORKSPACE",
  "billing.subscription_changed": "SUBSCRIPTION",
} as const satisfies Record<string, AuditEntityType>;
export type AuditAction = keyof typeof AUDIT_ACTION_ENTITY;

/**
 * A person or role as it was when the row was written, so the log still reads
 * after a rename or delete. A built-in role predating role rows has no id.
 */
export type AuditRef = { id: string | null; name: string };

/**
 * What a subscription looked like before or after a change. `status` is null on
 * a stored row that never had a Stripe subscription.
 */
export type AuditSubscriptionState = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus | null;
  cancelAtPeriodEnd: boolean;
};

/** The `metadata` each action's rows carry. */
export type AuditMetadata = {
  "member.role_changed": { member: AuditRef; from: AuditRef; to: AuditRef };
  "member.removed": { member: AuditRef; role: AuditRef };
  "member.left": { member: AuditRef; role: AuditRef };
  "invitation.sent": { email: string; role: AuditRef };
  "invitation.revoked": { email: string };
  "invitation.accepted": { email: string; role: AuditRef };
  "role.created": { role: AuditRef; permissions: string[] };
  "role.updated": {
    role: AuditRef;
    name?: { from: string; to: string };
    permissions?: { added: string[]; removed: string[] };
  };
  "role.deleted": { role: AuditRef };
  /** The description itself isn't copied, only that it changed. */
  "workspace.updated": {
    name?: { from: string; to: string };
    description?: true;
  };
  "ownership.transferred": { from: AuditRef; to: AuditRef };
  /** `from` is null for a workspace's first subscription. */
  "billing.subscription_changed": {
    from: AuditSubscriptionState | null;
    to: AuditSubscriptionState;
  };
};

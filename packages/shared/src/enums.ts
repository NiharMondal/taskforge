/**
 * The enums of apps/backend/prisma/schema.prisma, as plain string unions both
 * apps can use. The schema is the source of truth: the backend's
 * `shared-enums.spec.ts` fails if a value list here differs from Prisma's
 * generated enum (values and order), so change both in the same commit.
 */

export const WORKSPACE_ROLE_VALUES = [
  "OWNER",
  "ADMIN",
  "MEMBER",
  "VIEWER",
] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLE_VALUES)[number];

/**
 * What a workflow status means to the code, whatever the project calls it
 * (see `workflow.ts`). Ordered as work flows.
 */
export const STATUS_CATEGORY_VALUES = [
  "BACKLOG",
  "UNSTARTED",
  "STARTED",
  "COMPLETED",
] as const;
export type StatusCategory = (typeof STATUS_CATEGORY_VALUES)[number];

export const ISSUE_PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type IssuePriority = (typeof ISSUE_PRIORITY_VALUES)[number];

export const ISSUE_TYPE_VALUES = [
  "EPIC",
  "STORY",
  "TASK",
  "BUG",
  "SUBTASK",
] as const;
export type IssueType = (typeof ISSUE_TYPE_VALUES)[number];

/**
 * The types a client may pick. SUBTASK isn't one: creating with
 * `parentIssueId` is what makes a sub-issue, and its type never changes.
 */
export const SELECTABLE_ISSUE_TYPES = ["EPIC", "STORY", "TASK", "BUG"] as const;
export type SelectableIssueType = (typeof SELECTABLE_ISSUE_TYPES)[number];

export const INVITATION_STATUS_VALUES = [
  "PENDING",
  "ACCEPTED",
  "EXPIRED",
  "REVOKED",
] as const;
export type InvitationStatus = (typeof INVITATION_STATUS_VALUES)[number];

export const SUBSCRIPTION_PLAN_VALUES = ["FREE", "PRO", "ENTERPRISE"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLAN_VALUES)[number];

/** Stripe's subscription statuses, one for one. */
export const SUBSCRIPTION_STATUS_VALUES = [
  "ACTIVE",
  "TRIALING",
  "PAST_DUE",
  "UNPAID",
  "CANCELED",
  "INCOMPLETE",
  "INCOMPLETE_EXPIRED",
  "PAUSED",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS_VALUES)[number];

/** Built-in roles an invitation may grant. OWNER is never granted by invitation. */
export const INVITABLE_ROLES = ["ADMIN", "MEMBER", "VIEWER"] as const;

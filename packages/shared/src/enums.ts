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

/** Ordered as work flows, backlog to done. */
export const ISSUE_STATUS_VALUES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "QA_REQUESTED",
  "QA_FAILED",
  "DEPLOYED",
  "DONE",
] as const;
export type IssueStatus = (typeof ISSUE_STATUS_VALUES)[number];

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

/** Built-in roles an invitation may grant. OWNER is never granted by invitation. */
export const INVITABLE_ROLES = ["ADMIN", "MEMBER", "VIEWER"] as const;

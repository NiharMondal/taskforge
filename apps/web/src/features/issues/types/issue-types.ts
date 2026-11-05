/**
 * Issue domain types. Mirrors the Prisma `Issue` model
 * (apps/backend/prisma/schema.prisma) and what the issue routes return.
 *
 * Issues are scoped to BOTH a workspace (via the `x-workspace-id` header) and a
 * project (via the route `/projects/:projectId/issues`). The embedded
 * `reporter`/`assignee` users are optional: the list contract isn't confirmed to
 * include them, so the UI resolves names from the membership roster instead of
 * assuming they're present (AI_GUIDE → "never guess API").
 */

import type { IssueLabelRef } from "@/features/labels/types/label-types";

export type IssueStatus =
  | "BACKLOG"
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "QA_REQUESTED"
  | "QA_FAILED"
  | "DEPLOYED"
  | "DONE";

export type IssuePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type IssueType = "EPIC" | "STORY" | "TASK" | "BUG" | "SUBTASK";

export interface IssueUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface Sprint {
  id: string;
  name: string;
}

/** A parent issue as embedded in its sub-issues (list and detail routes). */
export interface ParentIssueRef {
  id: string;
  number: number;
  title: string;
}

/** A sub-issue as embedded in its parent (detail route only). */
export interface SubIssue {
  id: string;
  number: number;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId?: string | null;
  assignee?: IssueUser | null;
}
export interface Issue {
  id: string;
  title: string;
  description?: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  type: IssueType;
  /** Per-project sequence; shown with the project key as `WA-12` (see `IssueKey`). */
  number: number;
  /** Fractional index for board ordering within a lane (see `lib/rank.ts`). */
  rank?: string | null;
  workspaceId: string;
  projectId: string;
  sprintId?: string | null;
  /**
   * Only the list route embeds the sprint (`null` when unscheduled); the
   * single-issue route doesn't, so read `sprintId` when you only need the id.
   */
  sprint?: Sprint | null;
  /** Set on sub-issues. Nesting is one level deep: a sub-issue has no sub-issues. */
  parentIssueId?: string | null;
  /** Embedded by the list and detail routes; `null` for top-level issues. */
  parentIssue?: ParentIssueRef | null;
  /** Detail route only (`useSingleIssue`), ordered by number. */
  subIssues?: SubIssue[];
  /** Story points (0–100), despite the name; `null` when not estimated. */
  timeEstimate?: number | null;
  reporterId: string;
  assigneeId?: string | null;
  reporter?: IssueUser;
  assignee?: IssueUser | null;
  /** List and detail routes: the issue's labels, alphabetically. */
  labels?: IssueLabelRef[];
  /** List route only. The thread itself comes from the comments route. */
  _count?: { comments: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateIssueDto {
  title: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  /**
   * Never SUBTASK — the backend refuses it, and refuses any type sent with
   * `parentIssueId` or for an existing sub-issue.
   */
  type?: IssueType;
  /** Story points; `null` clears the estimate. */
  timeEstimate?: number | null;
  /** Workspace label ids. On update the list replaces the issue's labels. */
  labelIds?: string[];
  assigneeId?: string | null;
  sprintId?: string | null;
  /**
   * Create as a sub-issue of this issue (same project). The backend types it
   * SUBTASK and, without a `sprintId`, puts it in the parent's sprint.
   */
  parentIssueId?: string;
}

/**
 * Partial update — every issue mutation goes through PATCH (AI_GUIDE). `rank`
 * is updatable here (board reordering) but not part of `CreateIssueDto`: new
 * issues get appended to their lane server-side.
 */
export type UpdateIssueDto = Partial<CreateIssueDto> & { rank?: string | null };

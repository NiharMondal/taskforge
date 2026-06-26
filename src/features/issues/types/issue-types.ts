/**
 * Issue domain types. Mirrors the Prisma `Issue` model (.claude/schema.prisma).
 *
 * Issues are scoped to BOTH a workspace (via the `x-workspace-id` header) and a
 * project (via the route `/projects/:projectId/issues`). The embedded
 * `reporter`/`assignee` users are optional: the list contract isn't confirmed to
 * include them, so the UI resolves names from the membership roster instead of
 * assuming they're present (AI_GUIDE → "never guess API").
 */

export type IssueStatus =
  | "BACKLOG"
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE";

export type IssuePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface IssueUser {
  id: string;
  name: string;
  email: string;
}

export interface Sprint {
  id:string;
  name:string;
}
export interface Issue {
  id: string;
  title: string;
  description?: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  /** Fractional index for board ordering within a lane (see `lib/rank.ts`). */
  rank?: string | null;
  workspaceId: string;
  projectId: string;
  sprintId?: string | null;
  sprint: Sprint
  reporterId: string;
  assigneeId?: string | null;
  reporter?: IssueUser;
  assignee?: IssueUser | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIssueDto {
  title: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeId?: string | null;
  sprintId?: string | null;
}

/**
 * Partial update — every issue mutation goes through PATCH (AI_GUIDE). `rank`
 * is updatable here (board reordering) but not part of `CreateIssueDto`: new
 * issues get appended to their lane server-side.
 */
export type UpdateIssueDto = Partial<CreateIssueDto> & { rank?: string | null };

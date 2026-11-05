import type { Prisma } from "generated/prisma/client";

/**
 * Issue history, stored as `AuditLog` rows: `entityType` ISSUE, `entityId`
 * the issue's id, `userId` who did it. Rows are written in the same
 * transaction as the change, so history can't disagree with the issue.
 *
 * Names (assignee, sprint, labels) are copied into the row as they were at
 * the time, so the history still reads after a rename or a delete.
 */
export const ISSUE_ENTITY = "ISSUE";

export const IssueActivity = {
  /** No metadata. */
  created: "issue.created",
  /** `metadata: { changes: IssueChange[] }` — one row per save. */
  updated: "issue.updated",
  /**
   * Someone else's comment removed by a moderator (an author deleting their
   * own isn't recorded). `metadata: { author: Ref | null }` — null when the
   * author's account was deleted before the comment was.
   */
  commentDeleted: "comment.deleted",
} as const;

export type Ref = { id: string; name: string };
export type LabelRef = { id: string; name: string; color: string };

/** One field's change in an `issue.updated` row. */
export type IssueChange =
  | { field: "title"; from: string; to: string }
  /** The text itself isn't kept: it can be long, and the issue has it. */
  | { field: "description" }
  | { field: "status" | "priority" | "type"; from: string; to: string }
  | { field: "timeEstimate"; from: number | null; to: number | null }
  | { field: "assignee"; from: Ref | null; to: Ref | null }
  | { field: "sprint"; from: Ref | null; to: Ref | null }
  | { field: "labels"; added: LabelRef[]; removed: LabelRef[] };

/** The fields history tracks, with ids resolved to names. */
export type IssueSnapshot = {
  title: string;
  description: string | null;
  status: string;
  priority: string;
  type: string;
  timeEstimate: number | null;
  assignee: Ref | null;
  sprint: Ref | null;
  labels: LabelRef[];
};

/**
 * What a save changes. `after` holds only what was sent (`undefined` = left
 * alone); a value equal to the stored one isn't a change. Board position
 * (`rank`) isn't tracked — reordering a lane is not news.
 */
export function issueChanges(
  before: IssueSnapshot,
  after: Partial<IssueSnapshot>,
): IssueChange[] {
  const changes: IssueChange[] = [];

  if (after.title !== undefined && after.title !== before.title) {
    changes.push({ field: "title", from: before.title, to: after.title });
  }
  if (
    after.description !== undefined &&
    (after.description ?? "") !== (before.description ?? "")
  ) {
    changes.push({ field: "description" });
  }
  for (const field of ["status", "priority", "type"] as const) {
    const to = after[field];
    if (to !== undefined && to !== before[field]) {
      changes.push({ field, from: before[field], to });
    }
  }
  if (
    after.timeEstimate !== undefined &&
    after.timeEstimate !== before.timeEstimate
  ) {
    changes.push({
      field: "timeEstimate",
      from: before.timeEstimate,
      to: after.timeEstimate,
    });
  }
  for (const field of ["assignee", "sprint"] as const) {
    const to = after[field];
    if (to !== undefined && (to?.id ?? null) !== (before[field]?.id ?? null)) {
      changes.push({ field, from: before[field], to });
    }
  }
  if (after.labels) {
    const had = new Set(before.labels.map((l) => l.id));
    const has = new Set(after.labels.map((l) => l.id));
    const added = after.labels.filter((l) => !had.has(l.id));
    const removed = before.labels.filter((l) => !has.has(l.id));
    if (added.length || removed.length) {
      changes.push({ field: "labels", added, removed });
    }
  }

  return changes;
}

/** Write one history row; pass the transaction the change itself runs in. */
export function recordIssueActivity(
  db: Pick<Prisma.TransactionClient, "auditLog">,
  entry: {
    workspaceId: string;
    issueId: string;
    userId: string;
    action: (typeof IssueActivity)[keyof typeof IssueActivity];
    metadata?: { changes: IssueChange[] } | { author: Ref | null };
  },
) {
  return db.auditLog.create({
    data: {
      workspaceId: entry.workspaceId,
      userId: entry.userId,
      entityType: ISSUE_ENTITY,
      entityId: entry.issueId,
      action: entry.action,
      metadata: entry.metadata,
    },
  });
}

import { MessageSquare } from "lucide-react";

import { LabelChips } from "@/features/labels/components/LabelChip";

import type { Issue } from "../../types/issue-types";
import AssigneeAvatar from "../AssigneeAvatar";
import IssueKey from "../IssueKey";
import ParentTag from "../ParentTag";
import PriorityChip from "../PriorityChip";

/**
 * Pure visual of a board card. Shared by the sortable card and the
 * DragOverlay so the dragged element looks identical to the one in place.
 */
export default function IssueCardBody({
  issue,
  assigneeName,
}: {
  issue: Issue;
  assigneeName?: string;
}) {
  const commentCount = issue._count?.comments ?? 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <IssueKey issue={issue} />
        <ParentTag issue={issue} />
      </div>
      <p className="-mt-1 text-sm font-medium">{issue.title}</p>
      <LabelChips labels={issue.labels} />
      <div className="flex items-center justify-between gap-2">
        <PriorityChip priority={issue.priority} />
        {commentCount > 0 && (
          <span
            className="mr-auto flex items-center gap-1 text-xs text-muted tabular-nums"
            title={`${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {commentCount}
          </span>
        )}
        <AssigneeAvatar
          name={assigneeName}
          avatarUrl={issue.assignee?.avatarUrl}
          isAssigned={!!issue.assigneeId}
        />
      </div>
    </div>
  );
}

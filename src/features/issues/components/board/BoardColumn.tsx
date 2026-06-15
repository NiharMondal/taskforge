"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Chip } from "@heroui/react";

import type { Issue, IssueStatus } from "../../types/issue-types";
import BoardIssueCard from "./BoardIssueCard";

interface BoardColumnProps {
  status: IssueStatus;
  label: string;
  issues: Issue[];
  assigneeNames: Map<string, string>;
  onOpenIssue: (issue: Issue) => void;
}

/**
 * One Kanban column for a status. The whole column is a droppable target (so
 * empty columns still accept drops), and its cards form a vertical sortable
 * context. The column's droppable id IS the status string — that's how
 * {@link BoardView} maps a drop target to the new issue status.
 */
export default function BoardColumn({
  status,
  label,
  issues,
  assigneeNames,
  onOpenIssue,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex w-77.5 shrink-0 flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-sm font-semibold text-muted">{label}</h2>
        <Chip size="sm" variant="soft">
          {issues.length}
        </Chip>
      </div>

      <div
        ref={setNodeRef}
        className={`flex min-h-24 flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors ${
          isOver ? "border-accent bg-surface-secondary" : "border-border"
        }`}
      >
        <SortableContext
          items={issues.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {issues.map((issue) => (
            <BoardIssueCard
              key={issue.id}
              issue={issue}
              assigneeName={
                issue.assigneeId
                  ? assigneeNames.get(issue.assigneeId)
                  : undefined
              }
              onOpen={onOpenIssue}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

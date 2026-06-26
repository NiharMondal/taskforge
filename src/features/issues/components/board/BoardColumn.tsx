"use client";

import { useDndContext, useDroppable } from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Chip } from "@heroui/react";

import type { Issue, IssueStatus } from "../../types/issue-types";
import BoardIssueCard from "./BoardIssueCard";

const STATUS_ORDER: IssueStatus[] = [
	"BACKLOG",
	"TODO",
	"IN_PROGRESS",
	"IN_REVIEW",
	"DONE",
];

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
	const { setNodeRef } = useDroppable({ id: status });
	const { active, over } = useDndContext();

  const sourceStatus = active?.data?.current?.sortable?.containerId as
		| IssueStatus
		| undefined;
	const isOver =
		sourceStatus !== undefined &&
		Math.abs(
			STATUS_ORDER.indexOf(status) - STATUS_ORDER.indexOf(sourceStatus),
		) <= 0 &&
		(over?.id === status || issues.some((i) => i.id === over?.id));

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
					isOver
						? "border-accent bg-surface-secondary"
						: "border-border"
				}`}
			>
				<SortableContext
					id={status}
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

"use client";

import { useDndContext, useDroppable } from "@dnd-kit/core";
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
	/** Whether the viewer may drag cards in this lane. */
	canDrag: boolean;
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
	canDrag,
}: BoardColumnProps) {
	const { setNodeRef } = useDroppable({ id: status });
	const { active, over } = useDndContext();

	// The lane the dragged card currently sits in. BoardView moves the card
	// into a lane mid-drag only when it may be dropped there, so this is the
	// lane the drop will land in — highlight it while the pointer is over it.
	const cardLane = active?.data?.current?.sortable?.containerId as
		| IssueStatus
		| undefined;
	const isOver =
		cardLane === status &&
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
							canDrag={canDrag}
						/>
					))}
				</SortableContext>
			</div>
		</div>
	);
}

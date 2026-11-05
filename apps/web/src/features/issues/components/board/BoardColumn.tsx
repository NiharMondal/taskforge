"use client";

import { useDndContext, useDroppable } from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Chip } from "@heroui/react";

import type { WorkflowStatus } from "@/features/workflow/types/workflow-types";

import type { Issue } from "../../types/issue-types";
import BoardIssueCard from "./BoardIssueCard";

interface BoardColumnProps {
	status: WorkflowStatus;
	issues: Issue[];
	assigneeNames: Map<string, string>;
	onOpenIssue: (issue: Issue) => void;
	/** Whether the viewer may drag cards in this lane. */
	canDrag: boolean;
}

/**
 * One Kanban column for a workflow status. The whole column is a droppable
 * target (so empty columns still accept drops), and its cards form a vertical
 * sortable context. The column's droppable id IS the status id — that's how
 * {@link BoardView} maps a drop target to the new issue status.
 */
export default function BoardColumn({
	status,
	issues,
	assigneeNames,
	onOpenIssue,
	canDrag,
}: BoardColumnProps) {
	const { setNodeRef } = useDroppable({ id: status.id });
	const { active, over } = useDndContext();

	// The lane the dragged card currently sits in. BoardView moves the card
	// into a lane mid-drag only when it may be dropped there, so this is the
	// lane the drop will land in — highlight it while the pointer is over it.
	const cardLane = active?.data?.current?.sortable?.containerId as
		| string
		| undefined;
	const isOver =
		cardLane === status.id &&
		(over?.id === status.id || issues.some((i) => i.id === over?.id));

	return (
		<div className="flex w-77.5 shrink-0 flex-col gap-3">
			{/* Sticky inside the board's scroll area, so lane names stay in
			    view while scrolling a long sprint. */}
			<div className="sticky top-0 z-10 flex items-center gap-2 bg-background px-1 py-1">
				<span
					aria-hidden
					className="size-2 shrink-0 rounded-full"
					style={{ backgroundColor: status.color }}
				/>
				<h2 className="truncate text-sm font-semibold text-muted">
					{status.name}
				</h2>
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
					id={status.id}
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

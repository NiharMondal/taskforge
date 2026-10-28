"use client";

import { useDraggable } from "@dnd-kit/core";
import {
	Button,
	cn,
	DropdownItem,
	DropdownMenu,
	DropdownPopover,
	DropdownRoot,
	Label,
} from "@heroui/react";
import { CircleUserRound, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";

import Avatar from "@/components/ui/avatar";
import { IssueTypeIcon, PriorityIcon } from "@/features/issues/components/IssueIcons";
import IssueKey from "@/features/issues/components/IssueKey";
import ParentTag from "@/features/issues/components/ParentTag";
import StatusChip from "@/features/issues/components/StatusChip";
import type { Issue } from "@/features/issues/types/issue-types";
import { initialsOf } from "@/util/initials";

/** A section an issue can be moved to: a sprint id, or the backlog. */
export interface MoveTarget {
	id: string;
	label: string;
}

interface Props {
	issue: Issue;
	/** Id of the section this row sits in (see `BACKLOG_SECTION_ID`). */
	sectionId: string;
	assigneeName?: string;
	/** Other sections it can move to; empty hides the menu and disables drag. */
	moveTargets: MoveTarget[];
	onMove: (issue: Issue, targetId: string) => void;
}

/**
 * One backlog line: type, key, title, status, story points, priority, assignee.
 * Draggable onto another section; the ⋯ menu does the same move for keyboard
 * and touch users.
 */
export default function BacklogIssueRow({
	issue,
	sectionId,
	assigneeName,
	moveTargets,
	onMove,
}: Props) {
	const canMove = moveTargets.length > 0;
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: issue.id,
		data: { sectionId },
		disabled: !canMove,
	});

	return (
		<div
			ref={setNodeRef}
			{...attributes}
			{...listeners}
			className={cn(
				"touch-none outline-none focus-visible:ring-2 focus-visible:ring-accent",
				canMove && "cursor-grab active:cursor-grabbing",
				isDragging && "opacity-40",
			)}
		>
			<BacklogIssueRowBody
				issue={issue}
				assigneeName={assigneeName}
				menu={
					canMove && (
						<DropdownRoot>
							<Button
								isIconOnly
								size="sm"
								variant="ghost"
								aria-label={`Move ${issue.title}`}
							>
								<MoreHorizontal className="size-4" />
							</Button>
							<DropdownPopover className="min-w-44">
								<DropdownMenu
									aria-label="Move to"
									onAction={(key) => onMove(issue, String(key))}
								>
									{moveTargets.map((t) => (
										<DropdownItem
											key={t.id}
											id={t.id}
											textValue={`Move to ${t.label}`}
										>
											<Label>Move to {t.label}</Label>
										</DropdownItem>
									))}
								</DropdownMenu>
							</DropdownPopover>
						</DropdownRoot>
					)
				}
			/>
		</div>
	);
}

/**
 * The row's visuals, shared with the drag overlay so the dragged copy looks
 * like the row it came from.
 */
export function BacklogIssueRowBody({
	issue,
	assigneeName,
	menu,
}: {
	issue: Issue;
	assigneeName?: string;
	menu?: ReactNode;
}) {
	return (
		<div className="flex items-center gap-3 border-b border-border bg-surface px-3 py-2 last:border-b-0">
			<IssueTypeIcon type={issue.type} />
			<IssueKey issue={issue} className="w-16" />
			<ParentTag issue={issue} />
			<Link
				href={`/projects/${issue.projectId}/list/${issue.id}`}
				{...keepOutOfDrag}
				className="min-w-0 flex-1 truncate text-sm hover:underline"
			>
				{issue.title}
			</Link>
			<StatusChip status={issue.status} />
			<span
				className="hidden w-8 shrink-0 rounded bg-surface-tertiary px-1.5 py-0.5 text-center text-xs text-muted tabular-nums sm:block"
				title="Story points"
			>
				{issue.timeEstimate ?? "–"}
			</span>
			<PriorityIcon priority={issue.priority} />
			<span title={assigneeName ?? "Unassigned"} className="shrink-0">
				{issue.assigneeId ? (
					<Avatar
						size="sm"
						customSize
						src={issue.assignee?.avatarUrl ?? undefined}
						alt={assigneeName ?? "Assignee"}
						fallback={initialsOf(assigneeName)}
					/>
				) : (
					<CircleUserRound
						className="size-5 text-muted"
						aria-label="Unassigned"
					/>
				)}
			</span>
			<div className="w-8 shrink-0" {...keepOutOfDrag}>
				{menu}
			</div>
		</div>
	);
}

/**
 * The whole row is the drag handle, so its listeners see every pointer and key
 * event that bubbles up. Controls inside it (title link, ⋯ menu) stop theirs,
 * or Enter on the menu button would start a keyboard drag instead of opening it.
 */
const keepOutOfDrag = {
	onPointerDown: (e: PointerEvent) => e.stopPropagation(),
	onKeyDown: (e: KeyboardEvent) => e.stopPropagation(),
};

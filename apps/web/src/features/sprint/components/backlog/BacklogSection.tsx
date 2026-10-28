"use client";

import { useState, type ReactNode } from "react";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@heroui/react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { statusCategory } from "@/features/issues/constants";
import type { Issue } from "@/features/issues/types/issue-types";

interface Props {
	/** Droppable id: the sprint id, or `BACKLOG_SECTION_ID`. */
	id: string;
	title: string;
	/** Inline after the title: dates, an Active chip, ... */
	meta?: ReactNode;
	/** Right-aligned header controls (Start / Complete / Create sprint). */
	actions?: ReactNode;
	issues: Issue[];
	/** Shown in the body when the section has no issues. */
	emptyText: string;
	children: ReactNode;
}

/**
 * One block of the backlog — a sprint or the unscheduled backlog. The whole
 * block is a drop target, highlighted while an issue is dragged over it.
 */
export default function BacklogSection({
	id,
	title,
	meta,
	actions,
	issues,
	emptyText,
	children,
}: Props) {
	const [isOpen, setIsOpen] = useState(true);
	const { setNodeRef, isOver, active } = useDroppable({ id });
	// Dropping back on the section a row came from does nothing — don't
	// advertise it as a target.
	const isTarget =
		isOver && (active?.data.current as { sectionId?: string })?.sectionId !== id;

	const counts = { todo: 0, inProgress: 0, done: 0 };
	for (const issue of issues) counts[statusCategory(issue.status)]++;

	return (
		<section
			ref={setNodeRef}
			className={cn(
				"flex flex-col rounded-lg border bg-surface-secondary transition-colors",
				isTarget ? "border-accent" : "border-border",
			)}
		>
			<header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
				<button
					type="button"
					onClick={() => setIsOpen((o) => !o)}
					aria-expanded={isOpen}
					className="flex min-w-0 items-center gap-1.5 text-left"
				>
					{isOpen ? (
						<ChevronDown className="size-4 shrink-0 text-muted" />
					) : (
						<ChevronRight className="size-4 shrink-0 text-muted" />
					)}
					<span className="truncate text-sm font-semibold">{title}</span>
				</button>
				<span className="flex items-center gap-2 text-xs text-muted">
					{meta}
					<span>
						({issues.length} {issues.length === 1 ? "issue" : "issues"})
					</span>
				</span>

				<div className="ml-auto flex items-center gap-2">
					<span className="flex items-center gap-1 text-xs tabular-nums">
						<Count value={counts.todo} label="To do" className="bg-surface-tertiary text-muted" />
						<Count value={counts.inProgress} label="In progress" className="bg-accent/15 text-accent" />
						<Count value={counts.done} label="Done" className="bg-success/15 text-success" />
					</span>
					{actions}
				</div>
			</header>

			{isOpen && (
				<div className="mx-2 mb-2 overflow-hidden rounded-md border border-border">
					{issues.length === 0 ? (
						<p className="bg-surface px-3 py-6 text-center text-sm text-muted">
							{emptyText}
						</p>
					) : (
						children
					)}
				</div>
			)}
		</section>
	);
}

function Count({
	value,
	label,
	className,
}: {
	value: number;
	label: string;
	className: string;
}) {
	return (
		<span
			title={`${label}: ${value}`}
			aria-label={`${label}: ${value}`}
			className={cn("min-w-6 rounded px-1.5 py-0.5 text-center", className)}
		>
			{value}
		</span>
	);
}

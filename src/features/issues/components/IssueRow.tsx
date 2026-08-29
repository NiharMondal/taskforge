"use client";

import { CircleUserRound } from "lucide-react";

import { statusOptionsFor } from "../constants";
import type { Issue, IssueStatus } from "../types/issue-types";
import PriorityChip from "./PriorityChip";
import { useRouter } from "next/navigation";
import { TFSelect } from "@/components/ui/TFSelect";

interface IssueRowProps {
	issue: Issue;
	/** Display name for the assignee, resolved from the membership roster. */
	assigneeName?: string;
	onStatusChange: (issueId: string, status: IssueStatus) => void;
	onOpen: (issue: Issue) => void;
	isUpdating?: boolean;
}

/**
 * A single issue line: priority, title/description, assignee, and an inline
 * status Select that triggers an optimistic PATCH. Dumb component — the parent
 * owns the mutation; this only reports the intent via {@link onStatusChange}.
 *
 * The Select offers the issue's current status plus its legal next steps only
 * (see `STATUS_TRANSITIONS`), so work can't skip a stage from the list view.
 */
export default function IssueRow({
	issue,
	assigneeName,
	onStatusChange,
	isUpdating,
}: IssueRowProps) {
	const router = useRouter();
	// Current status + its legal next steps. A lone entry means the issue is
	// terminal (DONE), so there is nothing to pick and the Select is disabled.
	const statusOptions = statusOptionsFor(issue.status);
	const handleClick = () => {
		router.push(`/projects/${issue.projectId}/issues/${issue.id}`);
	};
	return (
		<div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-secondary">
			<PriorityChip priority={issue.priority} />
			<button
				type="button"
				onClick={handleClick}
				className="min-w-0 flex-1 text-left"
			>
				<p className="truncate font-medium hover:underline">
					{issue.title}
				</p>
			</button>

			<div className="hidden items-center gap-1.5 text-sm text-muted sm:flex">
				<CircleUserRound className="h-4 w-4" />
				<span className="max-w-28 truncate">
					{assigneeName ?? "Unassigned"}
				</span>
			</div>

			<TFSelect
				value={issue.status}
				isDisabled={isUpdating || statusOptions.length === 1}
				className="w-36 shrink-0"
				onChange={(key) => {
					if (key != null && key !== issue.status) {
						onStatusChange(issue.id, String(key) as IssueStatus);
					}
				}}
				options={statusOptions.map((s) => ({
					value: s.value,
					label: s.label,
				}))}
			/>
		</div>
	);
}

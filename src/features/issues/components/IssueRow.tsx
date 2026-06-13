"use client";

import { ListBox, Select } from "@heroui/react";
import { CircleUserRound } from "lucide-react";

import { ISSUE_STATUSES, STATUS_META } from "../constants";
import type { Issue, IssueStatus } from "../types/issue-types";
import PriorityChip from "./PriorityChip";
import { useRouter } from "next/navigation";

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
 */
export default function IssueRow({
	issue,
	assigneeName,
	onStatusChange,
	onOpen,
	isUpdating,
}: IssueRowProps) {
	const router = useRouter();
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

			<Select
				aria-label={`Status for ${issue.title}`}
				value={issue.status}
				isDisabled={isUpdating}
				onChange={(key) => {
					if (key != null && key !== issue.status) {
						onStatusChange(issue.id, String(key) as IssueStatus);
					}
				}}
				className="w-36 shrink-0"
			>
				<Select.Trigger>
					<Select.Value>
						{STATUS_META[issue.status].label}
					</Select.Value>
					<Select.Indicator />
				</Select.Trigger>
				<Select.Popover>
					<ListBox>
						{ISSUE_STATUSES.map((s) => (
							<ListBox.Item
								key={s.value}
								id={s.value}
								textValue={s.label}
							>
								{s.label}
							</ListBox.Item>
						))}
					</ListBox>
				</Select.Popover>
			</Select>
		</div>
	);
}

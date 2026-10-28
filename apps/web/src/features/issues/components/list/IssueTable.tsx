"use client";

import { Fragment, useState } from "react";

import { cn } from "@heroui/react";
import { ChevronDown, ChevronRight, CircleUserRound } from "lucide-react";
import Link from "next/link";

import Avatar from "@/components/ui/avatar";
import type { Permissions } from "@/features/memberships/lib/permissions";
import { formatDate } from "@/util/format-date";
import { initialsOf } from "@/util/initials";

import { PRIORITY_META } from "../../constants";
import type { Issue, IssueStatus } from "../../types/issue-types";
import { IssueTypeIcon, PriorityIcon } from "../IssueIcons";
import IssueKey from "../IssueKey";
import IssueStatusSelect from "../IssueStatusSelect";
import ParentTag from "../ParentTag";

interface Props {
	/** The (already filtered) issues to show. */
	issues: Issue[];
	/** userId → display name, from the workspace roster. */
	memberNames: Map<string, string>;
	permissions: Permissions;
	onStatusChange: (issueId: string, status: IssueStatus) => void;
	/** Issue currently being mutated, to disable its status picker. */
	updatingIssueId?: string;
}

const COLUMNS = ["Work", "Assignee", "Reporter", "Priority", "Status", "Sprint", "Created"];

/**
 * The List tab's table, newest first. A sub-issue nests under its parent
 * (collapsed behind a chevron) when the parent is in `issues`; when a filter
 * leaves the parent out, it stands alone with its "↳ WA-3" tag.
 */
export default function IssueTable({
	issues,
	memberNames,
	permissions,
	onStatusChange,
	updatingIssueId,
}: Props) {
	const [expanded, setExpanded] = useState<Set<string>>(new Set());

	const ids = new Set(issues.map((i) => i.id));
	const isNested = (i: Issue) => !!i.parentIssueId && ids.has(i.parentIssueId);
	const childrenOf = new Map<string, Issue[]>();
	for (const issue of issues) {
		if (!isNested(issue)) continue;
		const list = childrenOf.get(issue.parentIssueId!) ?? [];
		list.push(issue);
		childrenOf.set(issue.parentIssueId!, list);
	}
	const topLevel = issues
		.filter((i) => !isNested(i))
		.sort((a, b) => b.number - a.number);

	const toggle = (id: string) =>
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	const row = (issue: Issue, depth: 0 | 1) => {
		const children = childrenOf.get(issue.id) ?? [];
		const isOpen = expanded.has(issue.id);
		const assignee = issue.assigneeId
			? memberNames.get(issue.assigneeId) ?? issue.assignee?.name
			: undefined;
		const reporter = memberNames.get(issue.reporterId) ?? issue.reporter?.name;

		return (
			<tr
				key={issue.id}
				className="border-b border-border last:border-b-0 hover:bg-surface-secondary"
			>
				<td className="py-2 pr-3 pl-2">
					<div className={cn("flex min-w-0 items-center gap-2", depth && "pl-7")}>
						{children.length > 0 ? (
							<button
								type="button"
								onClick={() => toggle(issue.id)}
								aria-expanded={isOpen}
								aria-label={`${isOpen ? "Hide" : "Show"} ${children.length} sub-issues of ${issue.title}`}
								className="rounded p-0.5 text-muted hover:bg-surface-tertiary hover:text-foreground"
							>
								{isOpen ? (
									<ChevronDown className="size-4" />
								) : (
									<ChevronRight className="size-4" />
								)}
							</button>
						) : (
							!depth && <span className="w-5 shrink-0" />
						)}
						<IssueTypeIcon type={issue.type} />
						<IssueKey issue={issue} />
						{depth === 0 && <ParentTag issue={issue} />}
						<Link
							href={`/projects/${issue.projectId}/issues/${issue.id}`}
							className="min-w-0 truncate text-sm hover:underline"
						>
							{issue.title}
						</Link>
						{children.length > 0 && (
							<span className="shrink-0 text-xs text-muted">
								{children.length}
							</span>
						)}
					</div>
				</td>
				<td className="px-3 py-2">
					<span className="flex items-center gap-2 text-sm">
						{assignee ? (
							<Avatar
								size="sm"
								customSize
								src={issue.assignee?.avatarUrl ?? undefined}
								alt={assignee}
								fallback={initialsOf(assignee)}
							/>
						) : (
							<CircleUserRound className="size-5 shrink-0 text-muted" />
						)}
						<span className={cn("truncate", !assignee && "text-muted")}>
							{assignee ?? "Unassigned"}
						</span>
					</span>
				</td>
				<td className="truncate px-3 py-2 text-sm">{reporter ?? "—"}</td>
				<td className="px-3 py-2">
					<span className="flex items-center gap-1.5 text-sm">
						<PriorityIcon priority={issue.priority} />
						{PRIORITY_META[issue.priority].label}
					</span>
				</td>
				<td className="px-3 py-1.5">
					<IssueStatusSelect
						issue={issue}
						permissions={permissions}
						onChange={onStatusChange}
						isDisabled={updatingIssueId === issue.id}
						className="h-8 w-36"
					/>
				</td>
				<td className="truncate px-3 py-2 text-sm">
					{issue.sprint?.name ?? <span className="text-muted">Backlog</span>}
				</td>
				<td className="px-3 py-2 text-sm whitespace-nowrap text-muted">
					{formatDate(issue.createdAt, "dd MMM yyyy")}
				</td>
			</tr>
		);
	};

	return (
		<div className="overflow-x-auto rounded-lg border border-border bg-surface">
			<table className="w-full min-w-[960px] table-fixed border-collapse text-left">
				<colgroup>
					<col />
					<col className="w-44" />
					<col className="w-36" />
					<col className="w-28" />
					<col className="w-44" />
					<col className="w-32" />
					<col className="w-32" />
				</colgroup>
				<thead>
					<tr className="border-b border-border bg-surface-secondary text-xs font-medium text-muted">
						{COLUMNS.map((c, i) => (
							<th key={c} scope="col" className={cn("px-3 py-2", i === 0 && "pl-9")}>
								{c}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{topLevel.map((issue) => (
						<Fragment key={issue.id}>
							{row(issue, 0)}
							{expanded.has(issue.id) &&
								(childrenOf.get(issue.id) ?? [])
									.sort((a, b) => a.number - b.number)
									.map((child) => row(child, 1))}
						</Fragment>
					))}
				</tbody>
			</table>
		</div>
	);
}

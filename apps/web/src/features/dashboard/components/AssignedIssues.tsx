"use client";

import { Spinner } from "@heroui/react";
import { CircleCheckBig } from "lucide-react";
import Link from "next/link";

import ErrorAlert from "@/components/ui/error-alert";
import { IssueTypeIcon, PriorityIcon } from "@/features/issues/components/IssueIcons";
import StatusChip from "@/features/issues/components/StatusChip";
import { useAssignedIssues } from "@/features/issues/hooks/use-issues";
import type { AssignedIssue } from "@/features/issues/types/issue-types";

/** How many of the caller's open issues the dashboard lists. */
const ASSIGNED_ISSUES_LIMIT = 8;

/**
 * "Assigned to you": the caller's open issues across every project of the
 * workspace (`GET /issues/assigned`), most urgent first. Loads on its own so a
 * slow read never holds up the stat cards or the project grid.
 */
export default function AssignedIssues({ workspaceId }: { workspaceId: string }) {
	const { data, isLoading, isError, refetch } = useAssignedIssues(
		workspaceId,
		ASSIGNED_ISSUES_LIMIT,
	);
	const issues = data?.issues ?? [];
	const total = data?.total ?? 0;

	return (
		<section className="flex flex-col gap-4" aria-labelledby="assigned-issues">
			<div className="flex items-baseline justify-between gap-2">
				<h2 id="assigned-issues" className="text-lg font-semibold">
					Assigned to you
					{total > 0 && (
						<span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent tabular-nums">
							{total} open
						</span>
					)}
				</h2>
				{total > issues.length && (
					<span className="text-sm text-muted">
						Showing {issues.length} of {total}
					</span>
				)}
			</div>

			{isError ? (
				<ErrorAlert
					title="Couldn’t load your assigned issues"
					onRetry={() => refetch()}
				/>
			) : isLoading ? (
				<div className="flex items-center justify-center rounded-lg border border-border py-12">
					<Spinner size="sm" />
				</div>
			) : issues.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
					<CircleCheckBig className="h-8 w-8 text-muted" />
					<p className="font-medium">Nothing assigned to you</p>
					<p className="text-sm text-muted">
						Open issues assigned to you in any project will show up here.
					</p>
				</div>
			) : (
				<ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
					{issues.map((issue) => (
						<AssignedIssueRow key={issue.id} issue={issue} />
					))}
				</ul>
			)}
		</section>
	);
}

function AssignedIssueRow({ issue }: { issue: AssignedIssue }) {
	return (
		<li>
			<Link
				href={`/projects/${issue.projectId}/list/${issue.id}`}
				className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-secondary focus-visible:bg-surface-secondary focus-visible:outline-none"
			>
				<IssueTypeIcon type={issue.type} />
				<span className="shrink-0 font-mono text-xs text-muted tabular-nums">
					{issue.project.key}-{issue.number}
				</span>
				<span className="min-w-0 flex-1 truncate text-sm font-medium">
					{issue.title}
				</span>
				<span
					className="hidden max-w-40 truncate text-xs text-muted md:inline"
					title={issue.project.name}
				>
					{issue.project.name}
				</span>
				<StatusChip status={issue.status} className="hidden sm:inline-flex" />
				<PriorityIcon priority={issue.priority} />
			</Link>
		</li>
	);
}

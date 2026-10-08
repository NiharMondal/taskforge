"use client";

import { useMemo } from "react";

import { Button, Chip } from "@heroui/react";
import { ListTodo } from "lucide-react";

import type { Permissions } from "@/features/memberships/lib/permissions";

import { ISSUE_STATUSES } from "../constants";
import type { Issue, IssueStatus } from "../types/issue-types";
import IssueRow from "./IssueRow";

interface IssueListProps {
	issues: Issue[];
	/** userId → display name, from the workspace membership roster. */
	assigneeNames: Map<string, string>;
	/** Drives which status changes each row offers, and the empty-state CTA. */
	permissions: Permissions;
	onStatusChange: (issueId: string, status: IssueStatus) => void;
	onOpenIssue: (issue: Issue) => void;
	onCreateClick: () => void;
	/** Issue currently being mutated, to disable its inline controls. */
	updatingIssueId?: string;
}

/**
 * Issues grouped by status, in workflow order (backlog → done). Empty statuses
 * are hidden so the view stays compact; a full-empty project shows a CTA.
 */
export default function IssueList({
	issues,
	assigneeNames,
	permissions,
	onStatusChange,
	onOpenIssue,
	onCreateClick,
	updatingIssueId,
}: IssueListProps) {
	const grouped = useMemo(() => {
		const byStatus = new Map<IssueStatus, Issue[]>();
		for (const issue of issues) {
			const bucket = byStatus.get(issue.status) ?? [];
			bucket.push(issue);
			byStatus.set(issue.status, bucket);
		}
		return byStatus;
	}, [issues]);

	if (issues.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
				<ListTodo className="h-12 w-12 text-muted/40" />
				<div className="flex flex-col gap-1">
					<p className="font-medium">No issues yet</p>
					<p className="text-sm text-muted">
						{permissions.canCreateIssue
							? "Create the first issue to start tracking work in this project."
							: "Issues will appear here once an admin creates them."}
					</p>
				</div>
				{permissions.canCreateIssue && (
					<Button variant="outline" onPress={onCreateClick}>
						Create your first issue
					</Button>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			{ISSUE_STATUSES.map(({ value, label }) => {
				const bucket = grouped.get(value);
				if (!bucket || bucket.length === 0) return null;

				return (
					<section key={value} className="flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<h2 className="text-sm font-semibold text-muted">
								{label}
							</h2>
							<Chip size="sm" variant="soft">
								{bucket.length}
							</Chip>
						</div>

						<div className="flex flex-col gap-2">
							{bucket.map((issue) => (
								<IssueRow
									key={issue.id}
									issue={issue}
									assigneeName={
										issue.assigneeId
											? assigneeNames.get(
													issue.assigneeId,
												)
											: undefined
									}
									permissions={permissions}
									onStatusChange={onStatusChange}
									onOpen={onOpenIssue}
									isUpdating={updatingIssueId === issue.id}
								/>
							))}
						</div>
					</section>
				);
			})}
		</div>
	);
}

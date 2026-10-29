"use client";

import { TFSelect } from "@/components/ui/TFSelect";
import {
	canSetIssueStatus,
	type Permissions,
} from "@/features/memberships/lib/permissions";
import { useWorkflow } from "@/features/workflow/hooks/use-workflow";

import type { Issue } from "../types/issue-types";

/**
 * Inline status picker for a row: the issue's current status plus the
 * statuses its project's workflow lets it move to, minus any the viewer's
 * role may not set (VIEWER: all, MEMBER: completed ones). A lone option means
 * there's nothing to pick — no move out, or no permission — so it's disabled.
 */
export default function IssueStatusSelect({
	issue,
	permissions,
	onChange,
	isDisabled,
	className,
}: {
	issue: Issue;
	permissions: Permissions;
	onChange: (issueId: string, statusId: string) => void;
	isDisabled?: boolean;
	className?: string;
}) {
	const { view } = useWorkflow(issue.workspaceId, issue.projectId);
	const options = (view?.optionsFrom(issue.statusId) ?? [issue.status]).filter(
		(s) =>
			s.id === issue.statusId || canSetIssueStatus(permissions, s.category),
	);

	return (
		<TFSelect
			aria-label={`Status of ${issue.title}`}
			value={issue.statusId}
			isDisabled={isDisabled || options.length === 1}
			className={className}
			onChange={(key) => {
				if (key !== issue.statusId) onChange(issue.id, String(key));
			}}
			options={options.map((s) => ({ value: s.id, label: s.name }))}
		/>
	);
}

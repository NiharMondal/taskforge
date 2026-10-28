"use client";

import { TFSelect } from "@/components/ui/TFSelect";
import {
	canSetIssueStatus,
	type Permissions,
} from "@/features/memberships/lib/permissions";

import { statusOptionsFor } from "../constants";
import type { Issue, IssueStatus } from "../types/issue-types";

/**
 * Inline status picker for a row: the issue's current status plus its legal
 * next steps (see `STATUS_TRANSITIONS`), minus any the viewer's role may not
 * set (VIEWER: all, MEMBER: DONE). A lone option means there's nothing to
 * pick — terminal DONE, or no permission — so it's disabled.
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
	onChange: (issueId: string, status: IssueStatus) => void;
	isDisabled?: boolean;
	className?: string;
}) {
	const options = statusOptionsFor(issue.status).filter(
		(s) => s.value === issue.status || canSetIssueStatus(permissions, s.value),
	);

	return (
		<TFSelect
			aria-label={`Status of ${issue.title}`}
			value={issue.status}
			isDisabled={isDisabled || options.length === 1}
			className={className}
			onChange={(key) => {
				if (key !== issue.status) onChange(issue.id, key as IssueStatus);
			}}
			options={options.map((s) => ({ value: s.value, label: s.label }))}
		/>
	);
}

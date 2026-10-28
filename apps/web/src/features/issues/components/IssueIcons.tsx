import { cn } from "@heroui/react";

import { ISSUE_TYPE_META, PRIORITY_ICON_META } from "../constants";
import type { IssuePriority, IssueType } from "../types/issue-types";

/** Issue type as a small colored icon (with its name as tooltip / label). */
export function IssueTypeIcon({ type }: { type: IssueType }) {
	const { label, icon: Icon, className } = ISSUE_TYPE_META[type];
	return (
		<span title={label} className="shrink-0">
			<Icon className={cn("size-4", className)} aria-label={label} />
		</span>
	);
}

/** Priority as a small colored icon (with its name as tooltip / label). */
export function PriorityIcon({ priority }: { priority: IssuePriority }) {
	const { label, icon: Icon, className } = PRIORITY_ICON_META[priority];
	return (
		<span title={`${label} priority`} className="shrink-0">
			<Icon
				className={cn("size-4", className)}
				aria-label={`${label} priority`}
			/>
		</span>
	);
}

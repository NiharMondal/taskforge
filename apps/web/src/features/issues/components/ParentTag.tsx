import { CornerDownRight } from "lucide-react";

import type { Issue } from "../types/issue-types";
import IssueKey from "./IssueKey";

/**
 * "↳ WA-3" on a sub-issue's row or card, naming its parent (title on hover).
 * Renders nothing for a top-level issue.
 */
export default function ParentTag({
	issue,
}: {
	issue: Pick<Issue, "projectId" | "parentIssue">;
}) {
	const parent = issue.parentIssue;
	if (!parent) return null;

	return (
		<span
			title={`Sub-issue of ${parent.title}`}
			className="inline-flex shrink-0 items-center gap-0.5 rounded bg-surface-tertiary px-1 py-0.5"
		>
			<CornerDownRight className="size-3 text-muted" aria-hidden />
			<span className="sr-only">Sub-issue of</span>
			<IssueKey issue={{ projectId: issue.projectId, number: parent.number }} />
		</span>
	);
}

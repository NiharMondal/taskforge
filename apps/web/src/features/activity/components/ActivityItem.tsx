import type { ReactNode } from "react";

import { formatDistanceToNow } from "date-fns";

import Avatar from "@/components/ui/avatar";
import { ISSUE_TYPE_META, PRIORITY_META } from "@/features/issues/constants";
import type {
	IssuePriority,
	IssueType,
} from "@/features/issues/types/issue-types";
import { LabelChips } from "@/features/labels/components/LabelChip";
import { formatDate } from "@/util/format-date";
import { DELETED_USER_NAME } from "@/types/common";
import { initialsOf } from "@/util/initials";

import type { IssueActivity, IssueChange } from "../types/activity-types";

/** A value in a sentence, set off from the words around it. */
function V({ children }: { children: ReactNode }) {
	return <span className="font-medium text-foreground">{children}</span>;
}

/**
 * Status changes are recorded by the status's name. Rows written before
 * projects had their own workflows hold the old fixed status's key instead.
 */
const LEGACY_STATUS_LABELS: Record<string, string> = {
	BACKLOG: "Backlog",
	TODO: "To Do",
	IN_PROGRESS: "In Progress",
	IN_REVIEW: "In Review",
	QA_REQUESTED: "QA Requested",
	QA_FAILED: "QA Failed",
	DEPLOYED: "Deployed",
	DONE: "Done",
};
const statusLabel = (v: string) => LEGACY_STATUS_LABELS[v] ?? v;
// History can outlive an enum value, so fall back to the raw one.
const priorityLabel = (v: string) =>
	PRIORITY_META[v as IssuePriority]?.label ?? v;
const typeLabel = (v: string) => ISSUE_TYPE_META[v as IssueType]?.label ?? v;
const points = (n: number) => `${n} ${n === 1 ? "point" : "points"}`;

/** One change as the rest of a sentence that starts with who did it. */
function describeChange(change: IssueChange): ReactNode {
	switch (change.field) {
		case "title":
			return (
				<>
					renamed the issue from <V>“{change.from}”</V> to{" "}
					<V>“{change.to}”</V>
				</>
			);
		case "description":
			return "updated the description";
		case "status":
			return (
				<>
					changed the status from <V>{statusLabel(change.from)}</V> to{" "}
					<V>{statusLabel(change.to)}</V>
				</>
			);
		case "priority":
			return (
				<>
					changed the priority from <V>{priorityLabel(change.from)}</V> to{" "}
					<V>{priorityLabel(change.to)}</V>
				</>
			);
		case "type":
			return (
				<>
					changed the type from <V>{typeLabel(change.from)}</V> to{" "}
					<V>{typeLabel(change.to)}</V>
				</>
			);
		case "timeEstimate":
			if (change.from === null && change.to !== null) {
				return (
					<>
						estimated it at <V>{points(change.to)}</V>
					</>
				);
			}
			if (change.to === null && change.from !== null) {
				return (
					<>
						removed the estimate of <V>{points(change.from)}</V>
					</>
				);
			}
			return (
				<>
					changed the estimate from <V>{points(change.from ?? 0)}</V> to{" "}
					<V>{points(change.to ?? 0)}</V>
				</>
			);
		case "assignee":
			if (!change.from && change.to) {
				return (
					<>
						assigned it to <V>{change.to.name}</V>
					</>
				);
			}
			if (change.from && !change.to) {
				return (
					<>
						unassigned <V>{change.from.name}</V>
					</>
				);
			}
			return (
				<>
					reassigned it from <V>{change.from?.name}</V> to{" "}
					<V>{change.to?.name}</V>
				</>
			);
		case "sprint":
			if (!change.from && change.to) {
				return (
					<>
						added it to <V>{change.to.name}</V>
					</>
				);
			}
			if (change.from && !change.to) {
				return (
					<>
						moved it from <V>{change.from.name}</V> to the backlog
					</>
				);
			}
			return (
				<>
					moved it from <V>{change.from?.name}</V> to <V>{change.to?.name}</V>
				</>
			);
		case "labels":
			return (
				<span className="inline-flex flex-wrap items-center gap-1">
					{change.added.length > 0 && (
						<>
							added
							<LabelChips labels={change.added} max={10} />
						</>
					)}
					{change.added.length > 0 && change.removed.length > 0 && "and"}
					{change.removed.length > 0 && (
						<>
							removed
							<LabelChips labels={change.removed} max={10} />
						</>
					)}
				</span>
			);
	}
}

/**
 * One history row in the issue's timeline: who, what, when. A save that
 * changed several fields reads as "made N changes" with a line for each.
 */
export default function ActivityItem({ entry }: { entry: IssueActivity }) {
	const who = entry.user?.name ?? "Someone";
	const changes =
		entry.action === "issue.updated" ? entry.metadata.changes : [];

	const headline =
		entry.action === "issue.created" ? (
			"created the issue"
		) : entry.action === "comment.deleted" ? (
			<>
				deleted a comment by{" "}
				<V>{entry.metadata.author?.name ?? DELETED_USER_NAME.toLowerCase()}</V>
			</>
		) : changes.length === 1 ? (
			describeChange(changes[0])
		) : (
			`made ${changes.length} changes`
		);

	return (
		<li className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
			<span className="flex w-8 shrink-0 justify-center pt-0.5">
				<Avatar
					size="sm"
					customSize
					src={entry.user?.avatarUrl ?? undefined}
					alt={who}
					fallback={initialsOf(who)}
				/>
			</span>
			<div className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted">
				<p>
					<V>{who}</V> {headline}{" "}
					<time
						dateTime={entry.createdAt}
						title={formatDate(entry.createdAt, "dd MMM yyyy, hh:mm a")}
						className="text-xs whitespace-nowrap"
					>
						· {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
					</time>
				</p>
				{changes.length > 1 && (
					<ul className="flex list-disc flex-col gap-1 pl-5">
						{changes.map((change, i) => (
							<li key={`${change.field}-${i}`}>{describeChange(change)}</li>
						))}
					</ul>
				)}
			</div>
		</li>
	);
}

"use client";

import { useMemo, useState } from "react";

import { cn, Spinner, toast } from "@heroui/react";

import ErrorAlert from "@/components/ui/error-alert";
import CommentForm from "@/features/comments/components/CommentForm";
import CommentItem from "@/features/comments/components/CommentItem";
import {
	useComments,
	useCreateComment,
} from "@/features/comments/hooks/use-comments";
import type { TCommentValues } from "@/features/comments/schema/comment-schema";
import type { IssueComment } from "@/features/comments/types/comment-types";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { getApiErrorMessage } from "@/lib/api-error";

import { useIssueActivity } from "../hooks/use-issue-activity";
import type { IssueActivity } from "../types/activity-types";
import ActivityItem from "./ActivityItem";

type Props = {
	workspaceId: string;
	projectId: string;
	issueId: string;
};

type View = "all" | "comments" | "history";

type Entry =
	| { kind: "comment"; at: string; comment: IssueComment }
	| { kind: "history"; at: string; entry: IssueActivity };

const EMPTY_TEXT: Record<View, string> = {
	all: "Nothing here yet.",
	comments: "No comments yet.",
	history: "No history yet.",
};

/**
 * The issue's activity: comments and history in one timeline, oldest first,
 * with a switch to show only one of them. Everyone in the workspace can read
 * both; writing, editing and deleting comments follows the role
 * (`canComment`, `canDeleteAnyComment`) and authorship.
 */
export default function IssueActivityPanel({
	workspaceId,
	projectId,
	issueId,
}: Props) {
	const [view, setView] = useState<View>("all");
	const commentsQuery = useComments(workspaceId, projectId, issueId);
	const historyQuery = useIssueActivity(workspaceId, projectId, issueId);
	const { mutateAsync: createComment, isPending } = useCreateComment(
		workspaceId,
		projectId,
		issueId,
	);
	const permissions = useWorkspacePermissions();

	const comments = commentsQuery.data;
	const history = historyQuery.data;
	const entries = useMemo<Entry[]>(() => {
		const all: Entry[] = [
			...(view !== "history" ? (comments ?? []) : []).map(
				(comment): Entry => ({ kind: "comment", at: comment.createdAt, comment }),
			),
			...(view !== "comments" ? (history ?? []) : []).map(
				(entry): Entry => ({ kind: "history", at: entry.createdAt, entry }),
			),
		];
		// ISO timestamps sort as strings.
		return all.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
	}, [comments, history, view]);

	const failed = [commentsQuery, historyQuery].find((q) => q.isError);
	const isLoading = commentsQuery.isLoading || historyQuery.isLoading;

	const handleCreate = async ({ content }: TCommentValues) => {
		try {
			await createComment({ content });
			return true;
		} catch (err) {
			toast.danger(getApiErrorMessage(err, "Failed to add comment"));
			return false;
		}
	};

	const views: { id: View; label: string }[] = [
		{ id: "all", label: "All" },
		{
			id: "comments",
			label: comments?.length ? `Comments (${comments.length})` : "Comments",
		},
		{ id: "history", label: "History" },
	];

	return (
		<section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="text-sm font-semibold">Activity</h2>
				<div
					role="group"
					aria-label="Show"
					className="flex rounded-md border border-border p-0.5 text-xs"
				>
					{views.map((v) => (
						<button
							key={v.id}
							type="button"
							aria-pressed={view === v.id}
							onClick={() => setView(v.id)}
							className={cn(
								"rounded px-2 py-1 transition-colors",
								view === v.id
									? "bg-surface-tertiary font-medium text-foreground"
									: "text-muted hover:text-foreground",
							)}
						>
							{v.label}
						</button>
					))}
				</div>
			</div>

			{failed ? (
				<ErrorAlert
					title="Couldn’t load activity"
					description={getApiErrorMessage(failed.error, "Please try again.")}
					onRetry={() => {
						commentsQuery.refetch();
						historyQuery.refetch();
					}}
				/>
			) : isLoading ? (
				<div className="flex items-center gap-2 text-sm text-muted">
					<Spinner size="sm" />
					Loading activity…
				</div>
			) : entries.length === 0 ? (
				<p className="text-sm text-muted">{EMPTY_TEXT[view]}</p>
			) : (
				<ul className="flex flex-col divide-y divide-border">
					{entries.map((e) => {
						if (e.kind === "history") {
							return <ActivityItem key={e.entry.id} entry={e.entry} />;
						}
						const isMine = e.comment.userId === permissions.userId;
						return (
							<CommentItem
								key={e.comment.id}
								comment={e.comment}
								workspaceId={workspaceId}
								projectId={projectId}
								canEdit={isMine && permissions.canComment}
								canDelete={
									(isMine && permissions.canComment) ||
									permissions.canDeleteAnyComment
								}
							/>
						);
					})}
				</ul>
			)}

			{view !== "history" && permissions.canComment && (
				<CommentForm onSubmit={handleCreate} isSubmitting={isPending} />
			)}
		</section>
	);
}

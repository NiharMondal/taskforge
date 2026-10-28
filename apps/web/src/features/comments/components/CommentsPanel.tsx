"use client";

import { Spinner, toast } from "@heroui/react";

import ErrorAlert from "@/components/ui/error-alert";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { getApiErrorMessage } from "@/lib/api-error";

import { useComments, useCreateComment } from "../hooks/use-comments";
import type { TCommentValues } from "../schema/comment-schema";
import CommentForm from "./CommentForm";
import CommentItem from "./CommentItem";

type Props = {
	workspaceId: string;
	projectId: string;
	issueId: string;
};

/**
 * An issue's discussion: the thread, oldest first, then a box to add to it.
 * Everyone in the workspace can read it; who may write, edit and delete comes
 * from the role (`canComment`, `canDeleteAnyComment`) and authorship.
 */
export default function CommentsPanel({
	workspaceId,
	projectId,
	issueId,
}: Props) {
	const {
		data: comments = [],
		isLoading,
		isError,
		error,
		refetch,
	} = useComments(workspaceId, projectId, issueId);
	const { mutateAsync: createComment, isPending } = useCreateComment(
		workspaceId,
		projectId,
		issueId,
	);
	const permissions = useWorkspacePermissions();

	const handleCreate = async ({ content }: TCommentValues) => {
		try {
			await createComment({ content });
			return true;
		} catch (err) {
			toast.danger(getApiErrorMessage(err, "Failed to add comment"));
			return false;
		}
	};

	return (
		<section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
			<h2 className="text-sm font-semibold">
				Comments
				{comments.length > 0 && (
					<span className="ml-1 font-normal text-muted">
						({comments.length})
					</span>
				)}
			</h2>

			{isError ? (
				<ErrorAlert
					title="Couldn’t load comments"
					description={getApiErrorMessage(error, "Please try again.")}
					onRetry={() => refetch()}
				/>
			) : isLoading ? (
				<div className="flex items-center gap-2 text-sm text-muted">
					<Spinner size="sm" />
					Loading comments…
				</div>
			) : comments.length === 0 ? (
				<p className="text-sm text-muted">No comments yet.</p>
			) : (
				<ul className="flex flex-col divide-y divide-border">
					{comments.map((comment) => {
						const isMine = comment.userId === permissions.userId;
						return (
							<CommentItem
								key={comment.id}
								comment={comment}
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

			{permissions.canComment && (
				<CommentForm onSubmit={handleCreate} isSubmitting={isPending} />
			)}
		</section>
	);
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { issueKeys } from "@/features/issues/hooks/use-issues";

import {
	createComment,
	deleteComment,
	getComments,
	updateComment,
} from "../api/comment-api";
import type { CommentDto, IssueComment } from "../types/comment-types";

/**
 * Query keys for an issue's comment thread, scoped by workspace, project and
 * issue like every other tenant-scoped key.
 */
export const commentKeys = {
	list: (workspaceId: string, projectId: string, issueId: string) =>
		["comments", workspaceId, projectId, issueId] as const,
};

export function useComments(
	workspaceId: string,
	projectId: string,
	issueId: string,
) {
	return useQuery({
		queryKey: commentKeys.list(workspaceId, projectId, issueId),
		queryFn: async () =>
			(await getComments(workspaceId, projectId, issueId)).data,
		enabled: !!workspaceId && !!projectId && !!issueId,
	});
}

/**
 * Adding or deleting a comment changes the count the issue list carries
 * (`_count.comments`, shown on board cards), so both refetch that list.
 */
function useCommentMutation<TVars>(
	workspaceId: string,
	projectId: string,
	issueId: string,
	mutationFn: (vars: TVars) => ReturnType<typeof createComment>,
	{ changesCount }: { changesCount: boolean },
) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: commentKeys.list(workspaceId, projectId, issueId),
			});
			if (changesCount) {
				queryClient.invalidateQueries({
					queryKey: issueKeys.list(workspaceId, projectId),
					exact: true,
				});
			}
		},
	});
}

export function useCreateComment(
	workspaceId: string,
	projectId: string,
	issueId: string,
) {
	return useCommentMutation(
		workspaceId,
		projectId,
		issueId,
		(dto: CommentDto) => createComment(workspaceId, projectId, issueId, dto),
		{ changesCount: true },
	);
}

export function useUpdateComment(
	workspaceId: string,
	projectId: string,
	issueId: string,
) {
	return useCommentMutation(
		workspaceId,
		projectId,
		issueId,
		({ commentId, dto }: { commentId: string; dto: CommentDto }) =>
			updateComment(workspaceId, projectId, issueId, commentId, dto),
		{ changesCount: false },
	);
}

export function useDeleteComment(
	workspaceId: string,
	projectId: string,
	issueId: string,
) {
	return useCommentMutation(
		workspaceId,
		projectId,
		issueId,
		(comment: IssueComment) =>
			deleteComment(workspaceId, projectId, issueId, comment.id),
		{ changesCount: true },
	);
}
